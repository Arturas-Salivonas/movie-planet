import type { Metadata } from 'next'
import '../src/index.css'
import { generateHomeMetadata } from '../lib/metadata'
import { GeistSans } from 'geist/font/sans'

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
      <body className={`${GeistSans.variable} ${GeistSans.className} h-full antialiased`}>
        {children}
      </body>
    </html>
  )
}
