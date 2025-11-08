import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as fs from 'fs'
import * as path from 'path'
import LocationPageClient from '../../../components/LocationPageClient'

interface LocationData {
  location: {
    city: string
    country: string
    slug: string
    coordinates: { lat: number; lng: number }
  }
  movies: Array<{
    movie_id: string
    title: string
    year: number
    genres: string[]
    poster?: string
    banner_1280?: string
    thumbnail_52?: string
    imdb_rating?: number
    londonLocationCount: number
  }>
  stats: {
    totalMovies: number
    totalLocations: number
    genres: Record<string, number>
    decades: Record<string, number>
    topRated: Array<{
      title: string
      year: number
      rating?: number
    }>
  }
}

// Generate static params for known locations
export async function generateStaticParams() {
  // For now, only London is available
  // In the future, add more cities: paris-france, new-york-usa, etc.
  return [
    { slug: 'london-uk' },
  ]
}

// Generate metadata for SEO
export async function generateMetadata({
  params
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const locationData = await getLocationData(params.slug)

  if (!locationData) {
    return {
      title: 'Location Not Found',
    }
  }

  const { location, stats } = locationData

  const title = `${location.city} Filming Locations - ${stats.totalMovies} Movies | FilmingMap`
  const description = `Explore ${stats.totalMovies} movies and TV series filmed in ${location.city}, ${location.country}. Featuring ${stats.totalLocations} unique filming locations across ${Object.keys(stats.genres).length} genres. From ${location.city === 'London' ? 'The Dark Knight to Sherlock' : 'iconic blockbusters to indie films'}.`

  const topGenres = Object.entries(stats.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([genre]) => genre)

  return {
    title,
    description,
    keywords: [
      `${location.city} filming locations`,
      `movies filmed in ${location.city}`,
      `${location.city} movie map`,
      location.city,
      location.country,
      ...topGenres,
      'filming locations',
      'movie tourism',
      'behind the scenes',
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://filmingmap.com/location/${params.slug}`,
      siteName: 'FilmingMap',
      images: [
        {
          url: `https://filmingmap.com/og-location-${params.slug}.jpg`,
          width: 1200,
          height: 630,
          alt: `${location.city} Filming Locations`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://filmingmap.com/og-location-${params.slug}.jpg`],
    },
    alternates: {
      canonical: `https://filmingmap.com/location/${params.slug}`,
    },
  }
}

// Load location data from JSON file
async function getLocationData(slug: string): Promise<LocationData | null> {
  try {
    const dataPath = path.join(process.cwd(), 'data', `location_${slug}.json`)

    if (!fs.existsSync(dataPath)) {
      return null
    }

    const data = fs.readFileSync(dataPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error loading location data for ${slug}:`, error)
    return null
  }
}

// Generate JSON-LD schema for location page
function generateLocationSchema(locationData: LocationData) {
  const { location, stats } = locationData

  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: `${location.city}, ${location.country}`,
    description: `Explore ${stats.totalMovies} movies filmed in ${location.city}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: location.coordinates.lat,
      longitude: location.coordinates.lng,
    },
    touristType: 'Film Tourism',
    includesAttraction: stats.topRated.slice(0, 5).map(movie => ({
      '@type': 'MovieTheater',
      name: movie.title,
      aggregateRating: movie.rating ? {
        '@type': 'AggregateRating',
        ratingValue: movie.rating,
        bestRating: 10,
      } : undefined,
    })),
  }
}

export default async function LocationPage({
  params
}: {
  params: { slug: string }
}) {
  const locationData = await getLocationData(params.slug)

  if (!locationData) {
    notFound()
  }

  const schema = generateLocationSchema(locationData)

  return (
    <>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Client Component */}
      <LocationPageClient
        movies={locationData.movies}
        location={locationData.location}
        stats={locationData.stats}
      />
    </>
  )
}
