'use client'
const messages = [
  {
    for: 'chat',
    type: 'message',
    id: 3,
    userId: 1,
    content:
      'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Sapiente quidem incidunt quibusdam esse eum officiis, possimus  nulla sit quas quis ipsa aspernatur.Optio modi assumenda  corrupti nesciunt ducimus! Aliquid, voluptate.',
  },
  {
    for: 'chat',
    type: 'message',
    id: 2,
    userId: 3,
    content:
      'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Sapiente quidem incidunt quibusdam esse eum officiis, possimus  nulla sit quas quis ipsa aspernatur.Optio modi assumenda  corrupti nesciunt ducimus! Aliquid, voluptate.',
  },
  {
    for: 'chat',
    type: 'message',
    id: 1,
    userId: 2,
    content:
      'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Sapiente quidem incidunt quibusdam esse eum officiis, possimus  nulla sit quas quis ipsa aspernatur.Optio modi assumenda  corrupti nesciunt ducimus! Aliquid, voluptate.',
  },
  {
    for: 'chat',
    type: 'exit',
    id: 5,
    userId: 3232,
    content: 'Has left the room.',
  },
  {
    for: 'chat',
    type: 'join',
    id: 6,
    userId: 3213,
    content: 'Has join the room.',
  },
]
export function Chat() {
  const userId = 1
  return (
    <div className="flex h-80 w-96 flex-col  justify-between border-2 border-gray-500 p-2">
      <div
        id="messages"
        className="scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch flex flex-col space-y-4 overflow-y-auto p-3"
      >
        {messages.map((message) => {
          return (
            <>
              {message.type === 'text' && message.userId !== userId ? (
                <div key={message.id} className="flex items-end">
                  <div className="order-2 mx-2 flex max-w-xs flex-col items-start space-y-2 text-xs">
                    <span className="inline-block rounded-lg rounded-bl-none bg-gray-300 px-4 py-2 text-gray-900">
                      {message.content}
                    </span>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex items-end justify-end">
                  <div className="order-1 mx-2 flex max-w-xs flex-col items-end space-y-2 text-xs">
                    <span className="inline-block rounded-lg rounded-br-none bg-blue-600 px-4 py-2 text-white ">
                      {message.content}
                    </span>
                  </div>
                </div>
              )}
              {message.type === 'exit' && (
                <div
                  key={message.id}
                  className=" flex flex-col items-center text-xs"
                >
                  <p className="text-red-500">{message.userId}</p>
                  <p className="text-red-500">{message.content}</p>
                </div>
              )}
              {message.type === 'join' && (
                <div
                  key={message.id}
                  className=" flex flex-col items-center text-xs"
                >
                  <p className="text-green-500">{message.userId}</p>
                  <p className="text-green-500">{message.content}</p>
                </div>
              )}
            </>
          )
        })}
      </div>

      <div className="mb-2 border-t-2 border-gray-200 px-4 pt-4 sm:mb-0">
        <div className="relative flex">
          <input
            type="text"
            placeholder="Write your message!"
            className="w-full rounded-md bg-gray-200 py-3  text-gray-600 placeholder-gray-600 focus:placeholder-gray-400 focus:outline-none"
          />
          <div className="absolute inset-y-0 right-0 hidden items-center sm:flex">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-3 text-white transition duration-500 ease-in-out hover:bg-blue-400 focus:outline-none"
            >
              <span className="font-bold">Enviar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
