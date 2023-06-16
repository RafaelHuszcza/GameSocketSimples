import { useEffect, useRef } from 'react'
import { cleanCookie } from './clean-cookie'

export function useWebSocket(roomId: string) {
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!roomId) return

    const socket = new WebSocket(`ws://localhost:3333/room/${roomId}`)
    socketRef.current = socket

    socket.onopen = () => {
      console.log('Conexão WebSocket estabelecida')
    }

    socket.onmessage = (event) => {
      const message = event.data
      console.log(`Mensagem recebida: ${message}`)
    }

    socket.onclose = () => {
      cleanCookie('token')
      console.log('Conexão WebSocket fechada')
    }

    socket.onerror = (error) => {
      console.error('Erro na conexão WebSocket:', error)
    }
    return () => {
      socket.close()
    }
  }, [roomId])

  const sendWebSocketMessage = (message: string) => {
    if (socketRef.current) {
      socketRef.current.send(message)
    } else {
      console.error('Conexão WebSocket não estabelecida')
    }
  }
  const Disconnect = () => {
    cleanCookie('token')
    if (socketRef.current) {
      socketRef.current.close()
    } else {
      console.error('Conexão WebSocket não estabelecida')
    }
  }

  return { sendWebSocketMessage, Disconnect }
}
