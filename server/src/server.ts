import 'dotenv/config'

import fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { roomsRoutes } from './routes/rooms'
import { env } from './env/index'
import { socketsRoutes } from './routes/sockets'
const app = fastify()

app.register(cors, {
  origin: 'http://localhost:3000',
  credentials: true,
})
app.register(cookie)
app.register(jwt, {
  secret: env.JWT_SECRET,
})
app.register(roomsRoutes)
app.register(require('@fastify/websocket'))
app.register(socketsRoutes)

app
  .listen({
    port: 3333,
    host: '0.0.0.0',
  })
  .then(() => {
    console.log('🚀 HTTP server running on port http://localhost:3333')
  })
