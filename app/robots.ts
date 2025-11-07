import { MetadataRoute } from 'next'

/**
 * Generate robots.txt for SEO crawler instructions
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cinemap.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
          '/private/',
        ],
      },
      // Specific rules for different bots if needed
      {
        userAgent: 'GPTBot',
        disallow: ['/'], // Block AI scrapers if desired
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
