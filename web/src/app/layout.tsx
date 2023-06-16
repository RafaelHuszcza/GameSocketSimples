import './globals.css'
import { ReactNode } from 'react'
import {
  Roboto_Flex as Roboto,
  Bai_Jamjuree as BaiJamjuree,
} from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

const roboto = Roboto({ subsets: ['latin'], variable: '--font-roboto' })

const baiJamjuree = BaiJamjuree({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-bai-jamjuree',
})

export const metadata = {
  title: 'Jogo da Vida',
  description: 'Um Jogo desenvolvido para o trabalho de Redes',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${baiJamjuree.variable} bg-gray-900 font-sans text-gray-200`}
      >
        <main className="flex h-screen w-screen flex-col">
          <Header />
          <div className="flex flex-1 flex-col  bg-cover">{children}</div>
          <Footer />
        </main>
      </body>
    </html>
  )
}
