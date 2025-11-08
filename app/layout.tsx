import type { Metadata } from 'next'
import Script from 'next/script'
import '../src/index.css'
import { generateHomeMetadata } from '../lib/metadata'
import { GeistSans } from 'geist/font/sans'
import { GA_MEASUREMENT_ID } from '../lib/analytics'

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

        {/* Google Analytics - Only in production */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </body>
    </html>
  )
}
