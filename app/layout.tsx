// app/layout.tsx
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],   // Türkçe için latin-ext önemli
  display: 'swap',
  variable: '--font',                // CSS'te kullandığın isimle aynı
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
