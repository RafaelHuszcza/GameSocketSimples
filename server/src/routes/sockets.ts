import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'
import { env } from 'process'
import { randomUUID } from 'crypto'

// Registro de Conexões por salas
const roomConnections: Map<string, Set<any>> = new Map()

export async function socketsRoutes(app: FastifyInstance) {
  // Socket na rota room/:id  Obs só entra logado nessa rota, verificação do front
  app.get(
    '/room/:roomId',
    { websocket: true },
    async (connection, req: FastifyRequest) => {
      // Recebe o token, que é convertido para o id do usuário, para identifica-lo
      const token = req.headers.cookie ? req.headers.cookie.split('=')[1] : null
      const { sub } = token ? jwt.verify(token, env.JWT_SECRET!) : { sub: null }
      // Verifica se o usuário realmente existe
      const userExist = await prisma.user.count({
        where: {
          id: sub?.toString(),
        },
      })
      // Caso não haja usuário, a conexão é cancelada
      if (userExist === 0) {
        connection.socket.close(1000, 'Conexão encerrada pelo servidor')
        return
      }
      // Recebe o roomId através de parâmetros
      const roomId = req?.params?.roomId

      // Adiciona a conexão atual ao conjunto de conexões ativas da sala
      if (!roomConnections.has(roomId)) {
        roomConnections.set(roomId, new Set())
      }
      // Verifica o limite máximo da sala, se já existirem 3 jogadores, fecha a conexão
      if (roomConnections.has(roomId) && roomConnections.size === 3) {
        connection.socket.close(1000, 'Conexão encerrada pelo servidor')
      }
      // Adiciona a conexão, na lista de conexões por sala
      const roomSet = roomConnections.get(roomId)
      if (roomSet) {
        roomSet.add({ connection: connection.socket, userId: sub })
        // Envia mensagem que o usuário entrou na sala
        roomSet.forEach(async (socket) => {
          const message = {
            id: randomUUID().toString(),
            for: 'chat',
            type: 'exit',
            userId: sub,
            content: `Has join the room.`,
          }
          socket.connection.send(JSON.stringify(message))
        })
      }

      // Quando uma nova mensagem é recebida do frontend
      connection.socket.on('message', (data) => {
        // Transforma a informação em json (( Ainda falta aqui))
        const message = JSON.parse(data)
        // Envia a mensagem para todas as conexões ativas da sala
        if (message.for === 'chat') {
          const roomSet = roomConnections.get(roomId)
          if (roomSet) {
            roomSet.forEach(async (socket) => {
              socket.connection.send(message)
            })
          }
        }
      })
      // Validações e execuções ao fechar as conexões
      connection.socket.on('close', async () => {
        console.log('Connection closed')
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
                roomSet.delete(socket)
                return
              }
              // Verifica-se se o usuário o host, pois se for, é necessário fechar a sala e encerrar todas conexões
              const isHost = await prisma.room.count({
                where: {
                  id: roomId,
                  hostId: userId,
                },
              })
              // é feita a deleção do usuário atual da lista de sockets pois a sua conexão foi encerrada

              roomSet.delete(socket)

              // Caso seja o host, é feito o delete da sala, o delete do usuário e a limpagem de conexões e usuário existentes
              if (isHost) {
                await prisma.room.delete({
                  where: {
                    id: roomId,
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
                // Por fim como o host encerrou, a sala foi encerrada, então é retirada da lista de sockets
                roomConnections.delete(roomId)
              } else {
                // Caso o usuário não seja o host, o mesmo já foi deletado da lista de sockets e agora seu usuário é deletado

                await prisma.user.delete({
                  where: {
                    id: userId,
                  },
                })
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
              }
            }
          })
        }
      })
    },
  )
}
