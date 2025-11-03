import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nil Sucu - Fizyoterapi Kliniği',
  description: 'Nil Sucu Fizyoterapi Kliniği - Bilimsel ve kişiye özel fizyoterapi hizmetleri',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  )
}