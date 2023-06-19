import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { FastifyRequest } from 'fastify/types/request'
import { z } from 'zod'
interface RoomParams {
  roomId: string
}

export async function roomsRoutes(app: FastifyInstance) {
  app.post('/room', async (request, reply) => {
    const bodySchema = z.object({
      username: z.string(),
    })

    const { username } = bodySchema.parse(request.body)
    const user = await prisma.user.create({
      data: {
        name: username,
      },
    })
    console.log(`usuário ${username} criado`)

    const token = app.jwt.sign(
      {
        name: user.name,
      },
      {
        sub: user.id,
        expiresIn: '30 days',
      },
    )

    const room = await prisma.room.create({
      data: {
        players: {
          connect: { id: user.id },
        },
        hostId: user.id,
      },
    })
    console.log(`sala ${room.id} criada`)

    reply.setCookie('token', token, {
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
      secure: false,
    })
    reply.code(201).send({ roomId: room.id, userId: user.id })
  })

  app.post(
    '/room/:roomId/join',
    async (request: FastifyRequest<{ Params: RoomParams }>, reply) => {
      const bodySchema = z.object({
        username: z.string(),
      })
      const { username } = bodySchema.parse(request.body)

      const { roomId } = request.params
      console.log(
        `Iniciando entrada do usuário ${username}  na sala room: ${roomId}`,
      )
      const room = await prisma.room.findUnique({
        where: {
          id: roomId,
        },
        include: {
          players: true,
        },
      })
      if (!room) {
        console.log('Sala não encontrada')
        reply.status(404).send({ message: 'Sala não encontrada' })
        return
      }
      if (room.players.length === 3) {
        console.log('Sala Cheia')
        reply.status(400).send({ message: 'Sala Cheia' })
        return
      }
      if (room.gameStarted) {
        console.log('Jogo já iniciado')
        reply.status(400).send({ message: 'Jogo já iniciado' })
        return
      }

      const user = await prisma.user.create({
        data: {
          name: username,
        },
      })
      console.log(`Usuário ${username} criado`)

      const token = app.jwt.sign(
        {
          name: user.name,
        },
        {
          sub: user.id,
          expiresIn: '30 days',
        },
      )

      await prisma.room.update({
        where: {
          id: roomId,
        },
        data: {
          players: {
            connect: {
              id: user.id,
            },
          },
        },
      })
      console.log(`Usuário ${username} adicionado a sala ${roomId}`)
      reply.setCookie('token', token, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: false,
        secure: false,
      })
      reply.code(200).send({ roomId: room.id, userId: user.id })
    },
  )
}
