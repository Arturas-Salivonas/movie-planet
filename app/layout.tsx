import type { Metadata } from 'next'
import Script from 'next/script'
import '../src/index.css'
import { generateHomeMetadata } from '../lib/metadata'
import { GA_MEASUREMENT_ID } from '../lib/analytics'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = generateHomeMetadata()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preload critical MapLibre CSS */}
        <link
          rel="preload"
          href="https://unpkg.com/maplibre-gl@5.11.0/dist/maplibre-gl.css"
          as="style"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@5.11.0/dist/maplibre-gl.css"
        />
        {/* Optimized system font stack - no external font loading */}
      </head>
      <body className="h-full antialiased" style={{fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'}}>
        {children}
        <Analytics />

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
