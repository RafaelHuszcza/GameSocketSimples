import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'
import { env } from 'process'
import { randomUUID } from 'crypto'
import { getNewXY } from '../utils/GameBoard'

// Registro de Conexões por salas
const roomConnections: Map<string, Array<any>> = new Map()

export async function socketsRoutes(app: FastifyInstance) {
  // Socket na rota room/:id  Obs só entra logado nessa rota, verificação do front
  app.get(
    '/room/:roomId',
    { websocket: true },
    async (connection, req: FastifyRequest) => {
      // Recebe o token, que é convertido para o id do usuário, para identifica-lo
      const token = req.cookies.token ?? null
      const { sub } = token ? jwt.verify(token, env.JWT_SECRET!) : { sub: null }
      // Verifica se o usuário realmente existe
      const userExist = await prisma.user.count({
        where: {
          id: sub?.toString(),
        },
      })
      // Caso não haja usuário, a conexão é cancelada
      if (userExist === 0) {
        connection.socket.close(
          1000,
          'Conexão encerrada pelo servidor. Usuário não existe',
        )
        return
      }
      // Recebe o roomId através de parâmetros
      const roomId = req?.params?.roomId

      // check if room exists using prisma
      const room = await prisma.room.findUnique({
        where: {
          id: roomId,
        },
        include: {
          players: true,
        },
      })
      // Caso não haja sala, a conexão é cancelada
      if (!room) {
        connection.socket.close(
          1000,
          'Conexão encerrada pelo servidor. Sala não existe',
        )
        return
      }
      // Verifica o limite máximo da sala, se já existirem 3 jogadores, fecha a conexão
      if (room.players.length > 3) {
        connection.socket.close(
          1000,
          'Conexão encerrada pelo servidor. Sala cheia',
        )
      }
      // Adiciona a conexão atual ao conjunto de conexões ativas da sala
      if (!roomConnections.has(roomId)) {
        console.log('Nova sala criada na lista de sockets')
        roomConnections.set(roomId, [])
      }

      // Adiciona a conexão, na lista de conexões por sala
      const roomSet = roomConnections.get(roomId)
      if (roomSet) {
        roomSet.push({ connection: connection.socket, userId: sub })
        console.log(`Novo conexão adicionada a sala ${roomId}`)
        // Envia mensagem que o usuário entrou na sala
        roomSet.forEach(async (socket) => {
          const message = {
            id: randomUUID().toString(),
            for: 'chat',
            type: 'join',
            userId: sub,
            content: `has join the room.`,
          }
          socket.connection.send(JSON.stringify(message))
        })
        console.log(`Chat de Entrada Enviado`)
      }

      // Quando uma nova mensagem é recebida do frontend
      connection.socket.on('message', async (data) => {
        // Transforma a informação em json
        const message = JSON.parse(data)
        console.log('Mensagem Recebida: ', message)
        // Envia a mensagem para todas as conexões ativas da sala
        if (message.for === 'chat') {
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            const username = await prisma.user.findFirstOrThrow({
              where: {
                id: message.userId,
              },
            })
            roomSet.forEach(async (socket) => {
              const newMessage = JSON.stringify({
                id: randomUUID().toString(),
                username: username.name,
                ...message,
              })
              socket.connection.send(newMessage)
            })
          }
          console.log(`Nova mensagem de chat recebida e direcionada`)
        } else if (message.for === 'game') {
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            if (message.type === 'start_game') {
              const choosenPlayer =
                roomSet[Math.floor(Math.random() * roomSet.length)].userId
              await prisma.room.update({
                where: {
                  id: roomId,
                },
                data: {
                  gameStarted: true,
                  currentTurnPlayerId: choosenPlayer,
                  positions: {
                    create: roomSet.map((socket) => ({
                      playerId: socket.userId,
                      positionX: 0,
                      positionY: 0,
                    })),
                  },
                },
              })
              roomSet.forEach(async (socket) => {
                socket.connection.send(
                  JSON.stringify({
                    for: 'game',
                    type: 'start_game',
                    userIdCurrentTurn: choosenPlayer,
                    playersIds: [...roomSet.map((socket) => socket.userId)],
                  }),
                )
              })
            } else if (message.type === 'roll_dice') {
              const currentUserIndex = roomSet.findIndex(
                (socket) => socket.userId === message.userId,
              )
              const nextUserIndex =
                currentUserIndex + 1 >= roomSet.length
                  ? 0
                  : currentUserIndex + 1
              const nextUserId = roomSet[nextUserIndex].userId
              const diceValue = Math.floor(Math.random() * 6) + 1
              const room = await prisma.room.findFirst({
                where: {
                  id: roomId,
                },
                include: {
                  positions: true,
                },
              })
              if (!room) return
              const currentPlayersPositions = room.positions
              const newPlayersPositions = currentPlayersPositions.map(
                (playerPosition) => {
                  if (
                    playerPosition.playerId === roomSet[currentUserIndex].userId
                  ) {
                    const { outX, outY } = getNewXY(
                      playerPosition.positionX,
                      playerPosition.positionY,
                      diceValue,
                    )
                    return {
                      ...playerPosition,
                      positionX: outX,
                      positionY: outY,
                    }
                  }
                  return playerPosition
                },
              )
              // Atualiza o DB
              for (const playerPosition of newPlayersPositions) {
                const { playerId, positionX, positionY } = playerPosition
                await prisma.positionPlayer.update({
                  where: { playerId },
                  data: {
                    positionX,
                    positionY,
                  },
                })
              }
              // Envia mensagem para todos os jogadores
              roomSet.forEach(async (socket) => {
                if (socket.userId === message.userId) {
                  socket.connection.send(
                    JSON.stringify({
                      for: 'game',
                      type: 'roll_dice',
                      diceValue,
                    }),
                  )
                }
                socket.connection.send(
                  JSON.stringify({
                    for: 'game',
                    type: 'end_turn',
                    userIdCurrentTurn: nextUserId,
                    newPlayersPositions,
                  }),
                )
              })
            }
          }
        }
      })

      // Validações e execuções ao fechar as conexões
      connection.socket.on('close', async () => {
        // Valida a sala
        const roomSet = roomConnections.get(roomId)
        if (roomSet) {
          // É preciso verificar todos os sockets do roomSet
          roomSet.forEach(async (socket) => {
            // Encontrado o Socket desconectado verificamos seu ID de usuário e se o usuário existe realmente
            if (socket.connection === connection.socket) {
              const userId = socket.userId
              const userExist = await prisma.user.count({
                where: {
                  id: userId,
                },
              })
              // Caso não haja usuário, é deletado da lista de conexões esse socket, e retorna, pois não há mais nada a fazer
              if (userExist === 0) {
                console.log('Fechamento de Seção com Usuário inexistente!')
                roomSet.splice(roomSet.indexOf(socket), 1)
                return
              }
              // é feita a deleção do usuário atual da lista de sockets pois a sua conexão foi encerrada
              console.log('Retirada de usuário da lista de sockets')
              roomSet.splice(roomSet.indexOf(socket), 1)

              // Verifica-se se o usuário o host, pois se for, é necessário fechar a sala e encerrar todas conexões
              const isHost = await prisma.room.count({
                where: {
                  id: roomId,
                  hostId: userId,
                },
              })

              // Caso seja o host, é feito o delete da sala, o delete do usuário e a limpagem de conexões e usuário existentes
              if (isHost) {
                console.log('Usuário é o host')
                await prisma.positionPlayer.deleteMany({
                  where: {
                    roomId,
                  },
                })
                await prisma.room.delete({
                  where: {
                    id: roomId,
                  },
                  include: {
                    positions: true,
                  },
                })
                await prisma.user.delete({
                  where: {
                    id: userId,
                  },
                })

                roomSet.forEach(async (socket) => {
                  socket.connection.close()
                  await prisma.user.delete({
                    where: {
                      id: socket.userId,
                    },
                  })
                })

                console.log('Demais conexões encerradas e usuários deletados')
                // Por fim como o host encerrou, a sala foi encerrada, então é retirada da lista de sockets
                roomConnections.delete(roomId)
                console.log('Sala retirada de sockets')
              } else {
                // A sala é atualizada, indicando que o antigo usuário, saiu da sala
                await prisma.room.update({
                  where: {
                    id: roomId,
                  },
                  data: {
                    players: {
                      disconnect: {
                        id: userId,
                      },
                    },
                  },
                  include: {
                    players: true,
                  },
                })
                console.log('usuário retirado da sala do banco')
                // Caso o usuário não seja o host, o mesmo já foi deletado da lista de sockets e agora seu usuário é deletado
                await prisma.user.delete({
                  where: {
                    id: userId,
                  },
                })
                console.log('Usuário Deletado')

                // Por fim para Cada usuário na sala é enviada uma mensagem indicando que o usuário saiu
                roomSet.forEach(async (socket) => {
                  const message = {
                    id: randomUUID().toString(),
                    for: 'chat',
                    type: 'exit',
                    userId,
                    content: `User has left the room.`,
                  }
                  socket.connection.send(JSON.stringify(message))
                })
                console.log('Mensagem de saída Enviada')
              }
            }
          })
        }
      })
    },
  )
}
