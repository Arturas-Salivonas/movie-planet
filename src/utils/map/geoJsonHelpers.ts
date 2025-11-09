/**
 * GeoJSON helper utilities for converting and transforming map data
 */

import type { Movie, Location } from '../../types'

export interface GeoJSONFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Point' | 'MultiPoint'
    coordinates: number[] | number[][]
  }
  properties: {
    movie_id: string
    tmdb_id: number
    title: string
    year: number
    poster: string | null
    thumbnail_52?: string | null
    banner_1280?: string | null
    trailer: string | null
    top_genre: string | null
    genres?: string[]
    short_description: string
    imdb_rating: number | null
    locations_count: number
    location_names: string[]
    has_timeline: boolean
    centroid?: [number, number]
  }
}

/**
 * Convert GeoJSON feature to Movie object
 */
export function convertFeatureToMovie(feature: GeoJSONFeature): Movie {
  // Extract locations from geometry
  let locations: Location[] = []

  if (feature.geometry.type === 'Point') {
    const [lng, lat] = feature.geometry.coordinates as number[]
    locations = [{
      lat,
      lng,
      city: feature.properties.location_names[0]?.split(',')[0] || 'Unknown',
      country: feature.properties.location_names[0]?.split(',')[1]?.trim() || 'Unknown',
      description: feature.properties.location_names[0]?.match(/\((.*?)\)/)?.[1] || ''
    }]
  } else if (feature.geometry.type === 'MultiPoint') {
    const coords = feature.geometry.coordinates as number[][]
    locations = coords.map((coord, idx) => {
      const [lng, lat] = coord
      const locationName = feature.properties.location_names[idx] || 'Unknown'
      const [city, country] = locationName.split(',').map(s => s.trim())
      const description = locationName.match(/\((.*?)\)/)?.[1] || ''
      return {
        lat,
        lng,
        city: city || 'Unknown',
        country: country || 'Unknown',
        description
      }
    })
  }

  return {
    movie_id: feature.properties.movie_id,
    title: feature.properties.title,
    year: feature.properties.year,
    imdb_id: feature.properties.movie_id,
    tmdb_id: String(feature.properties.tmdb_id),
    type: (feature.properties as any).type || 'movie',
    genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
    poster: feature.properties.poster || undefined,
    trailer: feature.properties.trailer || undefined,
    imdb_rating: feature.properties.imdb_rating || undefined,
    locations,
  }
}

/**
 * Create GeoJSON FeatureCollection from features array
 */
export function createGeoJSONCollection(features: any[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features as any
  }
}
