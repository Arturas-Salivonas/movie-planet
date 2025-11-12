import * as fs from 'fs'
import * as path from 'path'

/**
 * Location data structure
 */
export interface LocationData {
  city: string
  country: string
  slug: string
  coordinates?: {
    lat: number
    lng: number
  }
}

/**
 * Get all location slugs from data directory
 */
export function getAllLocationSlugs(): LocationData[] {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const files = fs.readdirSync(dataDir)

    // Find all location_*.json files
    const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))

    // Extract location data from each file
    const locations: LocationData[] = []

    for (const file of locationFiles) {
      try {
        const filePath = path.join(dataDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)

        if (data.location) {
          locations.push({
            city: data.location.city,
            country: data.location.country,
            slug: data.location.slug,
            coordinates: data.location.coordinates,
          })
        }
      } catch (error) {
        console.error(`Error reading location file ${file}:`, error)
      }
    }

    // Sort by country then city
    locations.sort((a, b) => {
      if (a.country !== b.country) {
        return a.country.localeCompare(b.country)
      }
      return a.city.localeCompare(b.city)
    })

    return locations
  } catch (error) {
    console.error('Error reading location files:', error)
    return []
  }
}

/**
 * Get location data by slug
 */
export function getLocationBySlug(slug: string): LocationData | null {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const filePath = path.join(dataDir, `location_${slug}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    if (data.location) {
      return {
        city: data.location.city,
        country: data.location.country,
        slug: data.location.slug,
        coordinates: data.location.coordinates,
      }
    }

    return null
  } catch (error) {
    console.error(`Error reading location ${slug}:`, error)
    return null
  }
}

/**
 * Count movies for a location
 */
export function getLocationMovieCount(slug: string): number {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const filePath = path.join(dataDir, `location_${slug}.json`)

    if (!fs.existsSync(filePath)) {
      return 0
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    return data.movies ? data.movies.length : 0
  } catch (error) {
    console.error(`Error reading location ${slug}:`, error)
    return 0
  }
}
