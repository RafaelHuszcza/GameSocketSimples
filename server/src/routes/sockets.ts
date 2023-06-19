import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'
import { env } from 'process'
import { randomUUID } from 'crypto'

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
      if (room.players.length >= 3) {
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
      }

      // Quando uma nova mensagem é recebida do frontend
      connection.socket.on('message', (data) => {
        // Transforma a informação em json (( Ainda falta aqui))
        const message = JSON.parse(data)
        console.log('received message: ', message)
        // Envia a mensagem para todas as conexões ativas da sala
        if (message.for === 'chat') {
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            roomSet.forEach(async (socket) => {
              socket.connection.send(
                JSON.stringify({
                  id: randomUUID().toString(),
                  ...message,
                }),
              )
            })
          }
        } else if (message.for === 'game') {
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            if (message.type === 'start_game') {
              const choosenPlayer =
                roomSet[Math.floor(Math.random() * roomSet.length)].userId
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
              // nao funcionou
              prisma.room.update({
                where: {
                  id: roomId,
                },
                data: {
                  gameStarted: true,
                },
              })
            } else if (message.type === 'roll_dice') {
              roomSet.forEach(async (socket) => {
                if (socket.userId === message.userId) {
                  socket.connection.send(
                    JSON.stringify({
                      for: 'game',
                      type: 'roll_dice',
                      diceValue: Math.floor(Math.random() * 6) + 1,
                    }),
                  )
                }
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
                roomSet.splice(roomSet.indexOf(socket), 1)
                return
              }
              // é feita a deleção do usuário atual da lista de sockets pois a sua conexão foi encerrada
              roomSet.splice(roomSet.indexOf(socket), 1)

              // Verifica-se se o usuário o host, pois se for, é necessário fechar a sala e encerrar todas conexões
              const isHost = await prisma.room.count({
                where: {
                  id: roomId,
                  hostId: userId,
                },
              })

              // Caso seja o host, é feito o delete da sala, o delete do usuário e a limpagem de conexões e usuário existentes
              // if (isHost) {
              //   await prisma.room.delete({
              //     where: {
              //       id: roomId,
              //     },
              //   })
              //   roomSet.forEach(async (socket) => {
              //     socket.connection.close()
              //     await prisma.user.delete({
              //       where: {
              //         id: socket.userId,
              //       },
              //     })
              //   })
              //   // Por fim como o host encerrou, a sala foi encerrada, então é retirada da lista de sockets
              //   roomConnections.delete(roomId)
              // } else {
              //   // A sala é atualizada, indicando que o antigo usuário, saiu da sala
              //   await prisma.room.update({
              //     where: {
              //       id: roomId,
              //     },
              //     data: {
              //       players: {
              //         disconnect: {
              //           id: userId,
              //         },
              //       },
              //     },
              //     include: {
              //       players: true,
              //     },
              //   })
              //   // Caso o usuário não seja o host, o mesmo já foi deletado da lista de sockets e agora seu usuário é deletado
              //   await prisma.user.delete({
              //     where: {
              //       id: userId,
              //     },
              //   })

              //   // Por fim para Cada usuário na sala é enviada uma mensagem indicando que o usuário saiu
              //   roomSet.forEach(async (socket) => {
              //     const message = {
              //       id: randomUUID().toString(),
              //       for: 'chat',
              //       type: 'exit',
              //       userId,
              //       content: `User has left the room.`,
              //     }
              //     socket.connection.send(JSON.stringify(message))
              //   })
              // }
            }
          })
        }
      })
    },
  )
}
