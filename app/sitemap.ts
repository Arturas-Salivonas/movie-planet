import { MetadataRoute } from 'next'
import { getAllMovieSlugs } from '../lib/movies'

/**
 * Generate sitemap for all movies
 * Optimized for 10k+ movies with proper priority and change frequency
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'
  const now = new Date()

  // Homepage
  const homepage: MetadataRoute.Sitemap[0] = {
    url: baseUrl,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 1.0,
  }

  // Get all movie slugs
  const movieSlugs = getAllMovieSlugs()

  console.log(`📄 Generating sitemap for ${movieSlugs.length} movies...`)

  // Movie pages - batch process for better performance
  const moviePages: MetadataRoute.Sitemap = movieSlugs.map((slug) => ({
    url: `${baseUrl}/movie/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  console.log(`✅ Sitemap generated: ${moviePages.length + 1} URLs`)

  return [homepage, ...moviePages]
}

// For very large sitemaps (10k+ pages), you can split into multiple sitemaps:
// See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
