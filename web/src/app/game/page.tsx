import CreateRoom from '@/components/CreateRoom'
import JoinRoom from '@/components/JoinRoom'

export default async function Game() {
  return (
    <div className="flex flex-col gap-10 p-8">
      <CreateRoom />
      <JoinRoom />
    </div>
  )
}
