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
      // Verifica se a sala existe no prisma
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
        roomConnections.set(roomId, [])
      }
      // Adiciona a conexão, na lista de conexões por sala
      const roomSet = roomConnections.get(roomId)
      if (roomSet) {
        roomSet.push({ connection: connection.socket, userId: sub })
        // Envia mensagem que o usuário entrou na sala para todos pertencentes a sala
        roomSet.forEach((socket) => {
          const message = {
            id: randomUUID().toString(),
            for: 'chat',
            type: 'join',
            userId: sub,
            content: `has join the room.`,
          }
          socket.connection.send(JSON.stringify(message))
        })
      }

      // Quando uma nova mensagem é recebida do frontend
      connection.socket.on('message', async (data) => {
        // Transforma a informação em json
        const message = JSON.parse(data)

        // Verifica se é chat ou jogo
        if (message.for === 'chat') {
          // Chat reenvia a mensagem para todas as conexões ativas da sala
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            // Procura o nome do usuário para usar no chat
            const username = await prisma.user.findFirstOrThrow({
              where: {
                id: message.userId,
              },
            })
            // Envia a mensagem para todos
            roomSet.forEach((socket) => {
              const newMessage = JSON.stringify({
                id: randomUUID().toString(),
                username: username.name,
                ...message,
              })
              socket.connection.send(newMessage)
            })
          }
        } else if (message.for === 'game') {
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            // Verificações de type de mensagem
            if (message.type === 'start_game') {
              // Seleciona aleatoriamente um jogador para começar o jogo
              const chosenPlayer =
                roomSet[Math.floor(Math.random() * roomSet.length)].userId
              // Atualiza a sala indicando que inicio o jogo, qual o jogador inicial e as posições deles
              await prisma.room.update({
                where: {
                  id: roomId,
                },
                data: {
                  gameStarted: true,
                  currentTurnPlayerId: chosenPlayer,
                  positions: {
                    create: roomSet.map((socket) => ({
                      playerId: socket.userId,
                      positionX: 0,
                      positionY: 0,
                    })),
                  },
                },
              })
              // Envia mensagem para todos informando o jogador a rolar o dado e a lista de jogadores
              roomSet.forEach((socket) => {
                socket.connection.send(
                  JSON.stringify({
                    for: 'game',
                    type: 'start_game',
                    userIdCurrentTurn: chosenPlayer,
                    playersIds: [...roomSet.map((socket) => socket.userId)],
                  }),
                )
              })
            } else if (message.type === 'roll_dice') {
              const roomTurn = await prisma.room.findUnique({
                where: {
                  id: roomId,
                },
              })

              // Verifica se o jogador tem a permissão de rodar o dado
              if (roomTurn?.currentTurnPlayerId === message.userId) {
                // Calcula o valor que foi tirado no dado
                const diceValue = Math.floor(Math.random() * 6) + 1
                // Pega as posições anteriores para que possa atualizar
                const roomPositions = await prisma.room.findFirst({
                  where: {
                    id: roomId,
                  },
                  include: {
                    positions: true,
                  },
                })
                // Se não tiver, deu algum erro, retorna
                if (!roomPositions) return

                // encontra o index do usuário no array de usuários da sala
                const currentUserIndex = roomSet.findIndex(
                  (socket) => socket.userId === message.userId,
                )

                // Aqui qeu tem que mexer da dar final game, acredito eu
                //
                //
                //
                //
                //
                //
                //
                //
                //
                //
                // calcula as nova posições, baseado no valor da dado
                const newPlayersPositions = roomPositions.positions.map(
                  (playerPosition) => {
                    if (
                      playerPosition.playerId ===
                      roomSet[currentUserIndex].userId
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
                // Atualiza o DB com as novas posições
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

                // calcula o novo jogador do dado
                const nextUserIndex =
                  currentUserIndex + 1 >= roomSet.length
                    ? 0
                    : currentUserIndex + 1

                const nextUserId = roomSet[nextUserIndex].userId
                // Atualiza a sala com o novo jogador do dado
                await prisma.room.update({
                  where: {
                    id: roomId,
                  },
                  data: {
                    currentTurnPlayerId: nextUserId,
                  },
                })

                // Envia o valor do dado para todos os jogadores  e indica que o turno acabou
                // retornando as novas posições e o novo jogador a jogar
                roomSet.forEach((socket) => {
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
              } else {
                // só retorna se não for a vez do usuário
              }
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
          for (const socket of roomSet) {
            // Encontrado o Socket desconectado verificamos seu ID de usuário e se o usuário existe realmente
            if (socket.connection === connection.socket) {
              const userId = socket.userId
              // É feita a retirada do usuário atual da lista de sockets e do banco
              roomSet.splice(roomSet.indexOf(socket), 1)
              await prisma.user.delete({
                where: {
                  id: userId,
                },
              })
              // Verifica-se se o usuário era o host
              const Host = await prisma.room.findFirst({
                where: {
                  id: roomId,
                  hostId: userId,
                },
              })
              // Caso seja o host, a sala termina, finalizando todas as conexões
              if (Host) {
                await prisma.positionPlayer.deleteMany({
                  where: {
                    roomId,
                  },
                })
                roomSet.forEach((socket) => {
                  socket.connection.close()
                })
              } else {
                // A sala é atualizada, indicando que o antigo usuário, saiu da sala
                const roomStats = await prisma.room.update({
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
                })
                await prisma.positionPlayer.delete({
                  where: {
                    playerId: userId,
                  },
                })

                // Para cada usuário na sala é enviada uma mensagem indicando que o usuário saiu
                roomSet.forEach((socket) => {
                  const message = {
                    id: randomUUID().toString(),
                    for: 'chat',
                    type: 'exit',
                    userId,
                    content: `User has left the room.`,
                  }
                  socket.connection.send(JSON.stringify(message))
                })
                console.log(roomStats)
                if (
                  roomStats &&
                  roomStats.gameStarted === true &&
                  roomStats.currentTurnPlayerId === userId
                ) {
                  const roomPositions = await prisma.room.findUnique({
                    where: {
                      id: roomId,
                    },
                    include: { positions: true },
                  })
                  // Seleciona o novo jogador a jogar o dado
                  const currentUserIndex = roomSet.findIndex(
                    (socket) => socket.userId === userId,
                  )
                  const nextUserIndex =
                    currentUserIndex + 1 >= roomSet.length
                      ? 0
                      : currentUserIndex + 1
                  const nextUserId = roomSet[nextUserIndex].userId

                  // Atualiza a sala indicando o novo player
                  if (roomPositions) {
                    const newPlayersPositions = roomPositions.positions
                    await prisma.room.update({
                      where: {
                        id: roomId,
                      },
                      data: {
                        currentTurnPlayerId: nextUserId,
                      },
                    })
                    // Envia mensagem para todos informando o novo jogador a jogar o dado
                    roomSet.forEach((socket) => {
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
            }
          }
          // Caso a sala esteja vazia, é feita o delete da sala da lista de sockets e do banco
          if (roomSet.length === 0) {
            roomConnections.delete(roomId)
            await prisma.room.delete({
              where: {
                id: roomId,
              },
            })
          }
        }
      })
    },
  )
}
