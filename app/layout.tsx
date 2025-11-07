import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../src/index.css'
import { generateHomeMetadata } from '../lib/metadata'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = generateHomeMetadata()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@5.11.0/dist/maplibre-gl.css"
        />
      </head>
      <body className={`${inter.className} h-full`}>
        {children}
      </body>
    </html>
  )
}
