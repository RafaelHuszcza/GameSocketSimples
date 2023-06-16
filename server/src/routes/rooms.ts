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

    reply.setCookie('token', token, {
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
      secure: false,
    })
    reply.send({ roomId: room.id })
  })

  app.post(
    '/room/:roomId/join',
    async (request: FastifyRequest<{ Params: RoomParams }>, reply) => {
      const bodySchema = z.object({
        username: z.string(),
      })
      const { roomId } = request.params

      const room = await prisma.room.findUnique({
        where: {
          id: roomId,
        },
        include: {
          players: true,
        },
      })
      if (!room) {
        reply.status(404).send({ message: 'Sala não encontrada' })
        return
      }
      if (room.players.length === 3) {
        reply.status(404).send({ message: 'Sala Cheia' })
        return
      }

      const { username } = bodySchema.parse(request.body)

      const user = await prisma.user.create({
        data: {
          name: username,
        },
      })

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
      reply.setCookie('token', token, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: false,
        secure: false,
      })
      reply.send({ roomId: room.id })
    },
  )
}
