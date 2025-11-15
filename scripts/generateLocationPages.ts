/**
 * Generate location pages for MAJOR CITIES ONLY with 3+ movies
 * Creates location_[slug].json files and clickable-regions.geojson
 */

import * as fs from 'fs'
import * as path from 'path'

interface Location {
  lat: number
  lng: number
  display_name?: string
  city?: string
  country?: string
  description?: string
  scene_description?: string
}

interface Movie {
  movie_id: string
  title: string
  year: number
  genres: string[]
  poster?: string
  banner_1280?: string
  thumbnail_52?: string
  imdb_rating?: number
  locations: Location[]
}

// Major world cities mapping - LOCAL NAME -> ENGLISH NAME
const MAJOR_CITIES: Record<string, { english: string; country: string }> = {
  // United Kingdom
  'London': { english: 'London', country: 'United Kingdom' },
  'Greater London': { english: 'London', country: 'United Kingdom' },
  'Birmingham': { english: 'Birmingham', country: 'United Kingdom' },
  'Manchester': { english: 'Manchester', country: 'United Kingdom' },
  'Glasgow': { english: 'Glasgow', country: 'United Kingdom' },
  'Edinburgh': { english: 'Edinburgh', country: 'United Kingdom' },
  'Liverpool': { english: 'Liverpool', country: 'United Kingdom' },
  'Bristol': { english: 'Bristol', country: 'United Kingdom' },
  'Cardiff': { english: 'Cardiff', country: 'United Kingdom' },
  'Belfast': { english: 'Belfast', country: 'United Kingdom' },

  // United States
  'Los Angeles': { english: 'Los Angeles', country: 'United States' },
  'New York': { english: 'New York', country: 'United States' },
  'New York City': { english: 'New York', country: 'United States' },
  'Chicago': { english: 'Chicago', country: 'United States' },
  'Houston': { english: 'Houston', country: 'United States' },
  'Phoenix': { english: 'Phoenix', country: 'United States' },
  'Philadelphia': { english: 'Philadelphia', country: 'United States' },
  'San Antonio': { english: 'San Antonio', country: 'United States' },
  'San Diego': { english: 'San Diego', country: 'United States' },
  'Dallas': { english: 'Dallas', country: 'United States' },
  'San Jose': { english: 'San Jose', country: 'United States' },
  'Austin': { english: 'Austin', country: 'United States' },
  'Jacksonville': { english: 'Jacksonville', country: 'United States' },
  'San Francisco': { english: 'San Francisco', country: 'United States' },
  'Columbus': { english: 'Columbus', country: 'United States' },
  'Indianapolis': { english: 'Indianapolis', country: 'United States' },
  'Seattle': { english: 'Seattle', country: 'United States' },
  'Denver': { english: 'Denver', country: 'United States' },
  'Washington': { english: 'Washington', country: 'United States' },
  'Boston': { english: 'Boston', country: 'United States' },
  'Nashville': { english: 'Nashville', country: 'United States' },
  'Detroit': { english: 'Detroit', country: 'United States' },
  'Portland': { english: 'Portland', country: 'United States' },
  'Las Vegas': { english: 'Las Vegas', country: 'United States' },
  'Miami': { english: 'Miami', country: 'United States' },
  'Atlanta': { english: 'Atlanta', country: 'United States' },
  'New Orleans': { english: 'New Orleans', country: 'United States' },

  // France
  'Paris': { english: 'Paris', country: 'France' },
  'Marseille': { english: 'Marseille', country: 'France' },
  'Lyon': { english: 'Lyon', country: 'France' },
  'Toulouse': { english: 'Toulouse', country: 'France' },
  'Nice': { english: 'Nice', country: 'France' },

  // Germany
  'Berlin': { english: 'Berlin', country: 'Germany' },
  'Hamburg': { english: 'Hamburg', country: 'Germany' },
  'München': { english: 'Munich', country: 'Germany' },
  'Munich': { english: 'Munich', country: 'Germany' },
  'Köln': { english: 'Cologne', country: 'Germany' },
  'Cologne': { english: 'Cologne', country: 'Germany' },
  'Frankfurt': { english: 'Frankfurt', country: 'Germany' },

  // Spain
  'Madrid': { english: 'Madrid', country: 'Spain' },
  'Barcelona': { english: 'Barcelona', country: 'Spain' },
  'Valencia': { english: 'Valencia', country: 'Spain' },
  'Sevilla': { english: 'Seville', country: 'Spain' },
  'Seville': { english: 'Seville', country: 'Spain' },

  // Italy
  'Roma': { english: 'Rome', country: 'Italy' },
  'Rome': { english: 'Rome', country: 'Italy' },
  'Milano': { english: 'Milan', country: 'Italy' },
  'Milan': { english: 'Milan', country: 'Italy' },
  'Napoli': { english: 'Naples', country: 'Italy' },
  'Naples': { english: 'Naples', country: 'Italy' },
  'Torino': { english: 'Turin', country: 'Italy' },
  'Turin': { english: 'Turin', country: 'Italy' },
  'Firenze': { english: 'Florence', country: 'Italy' },
  'Florence': { english: 'Florence', country: 'Italy' },
  'Venezia': { english: 'Venice', country: 'Italy' },
  'Venice': { english: 'Venice', country: 'Italy' },

  // Canada
  'Toronto': { english: 'Toronto', country: 'Canada' },
  'Vancouver': { english: 'Vancouver', country: 'Canada' },
  'Montreal': { english: 'Montreal', country: 'Canada' },
  'Montréal': { english: 'Montreal', country: 'Canada' },
  'Calgary': { english: 'Calgary', country: 'Canada' },
  'Ottawa': { english: 'Ottawa', country: 'Canada' },

  // Australia
  'Sydney': { english: 'Sydney', country: 'Australia' },
  'Melbourne': { english: 'Melbourne', country: 'Australia' },
  'Brisbane': { english: 'Brisbane', country: 'Australia' },
  'Perth': { english: 'Perth', country: 'Australia' },
  'Adelaide': { english: 'Adelaide', country: 'Australia' },

  // Other major cities
  'Tokyo': { english: 'Tokyo', country: 'Japan' },
  '東京': { english: 'Tokyo', country: 'Japan' },
  'Hong Kong': { english: 'Hong Kong', country: 'China' },
  '香港': { english: 'Hong Kong', country: 'China' },
  'Singapore': { english: 'Singapore', country: 'Singapore' },
  'Dubai': { english: 'Dubai', country: 'United Arab Emirates' },
  'Mumbai': { english: 'Mumbai', country: 'India' },
  'Delhi': { english: 'Delhi', country: 'India' },
  'Istanbul': { english: 'Istanbul', country: 'Turkey' },
  'İstanbul': { english: 'Istanbul', country: 'Turkey' },
  'Moscow': { english: 'Moscow', country: 'Russia' },
  'Москва': { english: 'Moscow', country: 'Russia' },
  'Prague': { english: 'Prague', country: 'Czech Republic' },
  'Praha': { english: 'Prague', country: 'Czech Republic' },
  'Vienna': { english: 'Vienna', country: 'Austria' },
  'Wien': { english: 'Vienna', country: 'Austria' },
  'Amsterdam': { english: 'Amsterdam', country: 'Netherlands' },
  'Brussels': { english: 'Brussels', country: 'Belgium' },
  'Bruxelles': { english: 'Brussels', country: 'Belgium' },
  'Brussel': { english: 'Brussels', country: 'Belgium' },
  'Dublin': { english: 'Dublin', country: 'Ireland' },
  'Copenhagen': { english: 'Copenhagen', country: 'Denmark' },
  'København': { english: 'Copenhagen', country: 'Denmark' },
  'Stockholm': { english: 'Stockholm', country: 'Sweden' },
  'Oslo': { english: 'Oslo', country: 'Norway' },
  'Helsinki': { english: 'Helsinki', country: 'Finland' },
  'Warsaw': { english: 'Warsaw', country: 'Poland' },
  'Warszawa': { english: 'Warsaw', country: 'Poland' },
  'Budapest': { english: 'Budapest', country: 'Hungary' },
  'Lisbon': { english: 'Lisbon', country: 'Portugal' },
  'Lisboa': { english: 'Lisbon', country: 'Portugal' },
  'Athens': { english: 'Athens', country: 'Greece' },
  'Αθήνα': { english: 'Athens', country: 'Greece' },
  'Athína': { english: 'Athens', country: 'Greece' },
  'Vilnius': { english: 'Vilnius', country: 'Lithuania' },
  'Riga': { english: 'Riga', country: 'Latvia' },
  'Tallinn': { english: 'Tallinn', country: 'Estonia' },
  'Bangkok': { english: 'Bangkok', country: 'Thailand' },
  'กรุงเทพมหานคร': { english: 'Bangkok', country: 'Thailand' },
  'Seoul': { english: 'Seoul', country: 'South Korea' },
  '서울': { english: 'Seoul', country: 'South Korea' },
  'Beijing': { english: 'Beijing', country: 'China' },
  '北京': { english: 'Beijing', country: 'China' },
  'Shanghai': { english: 'Shanghai', country: 'China' },
  '上海': { english: 'Shanghai', country: 'China' },
  'Mexico City': { english: 'Mexico City', country: 'Mexico' },
  'Ciudad de México': { english: 'Mexico City', country: 'Mexico' },
  'Buenos Aires': { english: 'Buenos Aires', country: 'Argentina' },
  'São Paulo': { english: 'Sao Paulo', country: 'Brazil' },
  'Rio de Janeiro': { english: 'Rio de Janeiro', country: 'Brazil' },
  'Cairo': { english: 'Cairo', country: 'Egypt' },
  'القاهرة': { english: 'Cairo', country: 'Egypt' },
  'Cape Town': { english: 'Cape Town', country: 'South Africa' },
  'Johannesburg': { english: 'Johannesburg', country: 'South Africa' },
}

// Simple slugify - only for English names
function simpleSlugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric
    .replace(/\s+/g, '-') // Spaces to dashes
    .replace(/-+/g, '-') // Remove duplicate dashes
    .replace(/^-+|-+$/g, '') // Trim dashes
}

// Calculate city center from multiple locations
function calculateCenter(locations: Location[]): { lat: number; lng: number } {
  const lat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length
  const lng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length
  return { lat, lng }
}

// Find major city from display_name by checking against our list
function findMajorCity(displayName: string): { city: string; country: string } | null {
  if (!displayName) return null

  const parts = displayName.split(',').map(p => p.trim())

  // Check each part against our major cities list
  for (const part of parts) {
    if (MAJOR_CITIES[part]) {
      return { city: MAJOR_CITIES[part].english, country: MAJOR_CITIES[part].country }
    }
  }

  return null
}

async function generateLocationPages() {
  console.log('🎬 Generating location pages for MAJOR CITIES ONLY with 3+ movies...\n')

  // Clean up old location files first
  const dataDir = path.join(process.cwd(), 'data')
  const files = fs.readdirSync(dataDir)
  const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))

  if (locationFiles.length > 0) {
    console.log(`🧹 Cleaning up ${locationFiles.length} old location files...`)
    locationFiles.forEach(file => {
      fs.unlinkSync(path.join(dataDir, file))
    })
  }

  // Read movies data
  const moviesPath = path.join(process.cwd(), 'data', 'movies_enriched.json')
  const movies: Movie[] = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

  console.log(`📊 Total movies: ${movies.length}`)

  // Group movies by MAJOR CITY ONLY (from predefined list)
  const cityMovies: Record<string, {
    movies: Movie[]
    locations: Location[]
    city: string
    country: string
  }> = {}

  let skipped = 0
  let matched = 0

  movies.forEach(movie => {
    movie.locations.forEach(location => {
      // Find major city from display_name
      const majorCity = findMajorCity(location.display_name || '')

      if (!majorCity) {
        skipped++
        return // Skip - not a major city
      }

      matched++
      const cityKey = `${majorCity.city}-${majorCity.country}`

      if (!cityMovies[cityKey]) {
        cityMovies[cityKey] = {
          movies: [],
          locations: [],
          city: majorCity.city,
          country: majorCity.country
        }
      }

      // Add movie if not already added for this city
      if (!cityMovies[cityKey].movies.find(m => m.movie_id === movie.movie_id)) {
        cityMovies[cityKey].movies.push(movie)
      }

      // Add location
      cityMovies[cityKey].locations.push(location)
    })
  })

  console.log(`\n✅ Matched ${matched} locations to major cities`)
  console.log(`⏭️  Skipped ${skipped} non-major city locations`)

  // Filter cities: must have 3+ movies
  const qualifiedCities = Object.entries(cityMovies)
    .filter(([_, data]) => data.movies.length >= 3)
    .sort((a, b) => b[1].movies.length - a[1].movies.length) // Sort by movie count

  console.log(`\n✅ Found ${qualifiedCities.length} major cities with 3+ movies\n`)

  const regionFeatures: any[] = []
  let generatedCount = 0

  // Generate location page for each city
  for (const [_, data] of qualifiedCities) {
    const city = data.city
    const country = data.country
    const slug = simpleSlugify(`${city}-${country}`)

    console.log(`📍 ${city}, ${country}: ${data.movies.length} movies`)

    // Calculate center coordinates
    const center = calculateCenter(data.locations)

    // Count locations per movie
    const moviesWithLocationCount = data.movies.map(movie => ({
      movie_id: movie.movie_id,
      title: movie.title,
      year: movie.year,
      genres: movie.genres,
      poster: movie.poster,
      banner_1280: movie.banner_1280,
      thumbnail_52: movie.thumbnail_52,
      imdb_rating: movie.imdb_rating,
      londonLocationCount: movie.locations.filter(loc => {
        const locCity = findMajorCity(loc.display_name || '')
        return locCity && locCity.city === city && locCity.country === country
      }).length
    }))

    // Calculate stats
    const genreCounts: Record<string, number> = {}
    const decadeCounts: Record<string, number> = {}
    let totalLocations = 0

    data.movies.forEach(movie => {
      // Count genres
      movie.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1
      })

      // Count decades
      const decade = `${Math.floor(movie.year / 10) * 10}s`
      decadeCounts[decade] = (decadeCounts[decade] || 0) + 1

      // Count locations in this city
      totalLocations += movie.locations.filter(loc => {
        const locCity = findMajorCity(loc.display_name || '')
        return locCity && locCity.city === city && locCity.country === country
      }).length
    })

    // Create location data file
    const locationData = {
      location: {
        city,
        country,
        slug,
        coordinates: center
      },
      movies: moviesWithLocationCount.sort((a, b) => {
        // Sort by rating, then year
        if (b.imdb_rating && a.imdb_rating) {
          return b.imdb_rating - a.imdb_rating
        }
        return b.year - a.year
      }),
      stats: {
        totalMovies: data.movies.length,
        totalLocations,
        genres: genreCounts,
        decades: decadeCounts
      }
    }

    // Write location data file
    const outputPath = path.join(process.cwd(), 'data', `location_${slug}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(locationData, null, 2))
    generatedCount++

    // Add to clickable regions GeoJSON
    regionFeatures.push({
      type: 'Feature',
      id: generatedCount,
      properties: {
        name: `${city}, ${country}`,
        slug,
        movieCount: data.movies.length,
        locationCount: totalLocations
      },
      geometry: {
        type: 'Point',
        coordinates: [center.lng, center.lat]
      }
    })
  }

  // Create GeoJSON file
  const geoJSON = {
    type: 'FeatureCollection',
    features: regionFeatures
  }

  const geoPath = path.join(process.cwd(), 'public', 'geo', 'clickable-regions.geojson')
  fs.mkdirSync(path.dirname(geoPath), { recursive: true })
  fs.writeFileSync(geoPath, JSON.stringify(geoJSON, null, 2))

  console.log(`\n✅ Generated ${generatedCount} location pages`)
  console.log(`✅ Created clickable-regions.geojson with ${regionFeatures.length} regions`)
  console.log(`\nLocation pages saved to: data/location_*.json`)
  console.log(`GeoJSON saved to: public/geo/clickable-regions.geojson`)
}

generateLocationPages().catch(console.error)
