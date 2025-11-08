/**
 * Metadata generation utilities for Next.js SEO
 */

import type { Metadata } from 'next'
import type { Movie } from './types'

const SITE_NAME = 'FilmingMap'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'
const SITE_DESCRIPTION = 'Explore filming locations of your favorite movies on an interactive 3D globe'

/**
 * Generate metadata for homepage
 */
export function generateHomeMetadata(): Metadata {
  return {
    title: `${SITE_NAME} - Discover Movie Filming Locations on an Interactive 3D Globe`,
    description: 'Explore 10,000+ movies and their authentic filming locations on a rotating 3D world map. Search by genre, year, and rating.',
    keywords: ['movie locations', 'filming locations', 'movie map', 'cinema', 'travel', 'movies', '3D globe'],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    openGraph: {
      title: `${SITE_NAME} - Movie Filming Locations`,
      description: SITE_DESCRIPTION,
      type: 'website',
      url: SITE_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: `${SITE_URL}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - Interactive Movie Location Map`,
        },
      ],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} - Movie Filming Locations`,
      description: SITE_DESCRIPTION,
      images: [`${SITE_URL}/og-image.jpg`],
      creator: '@FilmingMap',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: SITE_URL,
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      // yandex: 'your-verification-code',
      // bing: 'your-verification-code',
    },
  }
}

/**
 * Generate metadata for movie page
 */
export function generateMovieMetadata(movie: Movie, slug: string): Metadata {
  const title = `${movie.title} (${movie.year}) - Filming Locations | ${SITE_NAME}`
  const locationCount = movie.locations.length
  const locationSummary = locationCount === 1
    ? `1 filming location`
    : `${locationCount} filming locations`

  const description = `Explore the ${locationSummary} of ${movie.title} (${movie.year}). ${
    movie.genres.join(', ')
  }.${movie.imdb_rating ? ` IMDb: ${movie.imdb_rating}/10` : ''}`

  const movieUrl = `${SITE_URL}/movie/${slug}`
  const posterUrl = movie.poster?.startsWith('http')
    ? movie.poster
    : movie.poster
    ? `${SITE_URL}${movie.poster}`
    : `${SITE_URL}/default-poster.jpg`

  return {
    title,
    description,
    keywords: [
      movie.title,
      ...movie.genres,
      'filming locations',
      'movie locations',
      'behind the scenes',
      ...movie.locations.map(loc => `${loc.city}, ${loc.country}`).slice(0, 5),
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    openGraph: {
      title,
      description,
      type: 'video.movie',
      url: movieUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: posterUrl,
          width: 500,
          height: 750,
          alt: `${movie.title} poster`,
        },
      ],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [posterUrl],
      creator: '@FilmingMap',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: movieUrl,
    },
  }
}

/**
 * Generate JSON-LD structured data for website
 */
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/movie/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Generate JSON-LD structured data for movie
 */
export function generateMovieSchema(movie: Movie, slug: string) {
  const movieUrl = `${SITE_URL}/movie/${slug}`
  const posterUrl = movie.poster?.startsWith('http')
    ? movie.poster
    : movie.poster
    ? `${SITE_URL}${movie.poster}`
    : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    dateCreated: movie.year.toString(),
    genre: movie.genres,
    url: movieUrl,
    ...(movie.imdb_rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: movie.imdb_rating.toString(),
        bestRating: '10',
        worstRating: '1',
      },
    }),
    ...(posterUrl && {
      image: posterUrl,
    }),
    ...(movie.trailer && {
      trailer: {
        '@type': 'VideoObject',
        name: `${movie.title} Trailer`,
        embedUrl: `https://www.youtube.com/embed/${movie.trailer}`,
        thumbnailUrl: posterUrl,
        uploadDate: movie.year.toString(),
      },
    }),
    contentLocation: movie.locations.map((loc) => ({
      '@type': 'Place',
      name: `${loc.city}, ${loc.country}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: loc.city,
        addressCountry: loc.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: loc.lat.toString(),
        longitude: loc.lng.toString(),
      },
      ...(loc.description && {
        description: loc.description,
      }),
    })),
    sameAs: [
      `https://www.imdb.com/title/${movie.imdb_id}`,
      movie.tmdb_id && `https://www.themoviedb.org/movie/${movie.tmdb_id}`,
    ].filter(Boolean),
  }
}
