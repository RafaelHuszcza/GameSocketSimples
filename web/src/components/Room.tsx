'use client'
import { usePathname } from 'next/navigation'
import { useWebSocket } from '@/hooks/use-websocket'

export function Room() {
  const searchParams = usePathname()
  const roomId = searchParams.split('/').pop()
  const { sendWebSocketMessage, Disconnect } = useWebSocket(roomId as string)

  const handleSendMessage = () => {
    sendWebSocketMessage('Olá do cliente!')
  }
  const Disco = () => {
    Disconnect()
  }

  return (
    <div className="flex flex-col gap-10 p-8">
      <button onClick={handleSendMessage}>Enviar mensagem</button>
      <button onClick={Disco}>Desconectar</button>
      {roomId}
    </div>
  )
}
