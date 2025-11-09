/**
 * Hook for fetching and managing related movies
 * OPTIMIZED: Caches GeoJSON data to prevent repeated fetches
 */

import { useState, useCallback, useRef } from 'react'
import type { Movie } from '../types'

// Global cache for GeoJSON data (shared across component instances)
let cachedGeoJSON: any = null
let cachePromise: Promise<any> | null = null

export function useRelatedMovies() {
  const [relatedMovies, setRelatedMovies] = useState<Movie[]>([])
  const isFetchingRef = useRef(false)

  /**
   * Convert GeoJSON feature to Movie object
   */
  const convertFeatureToMovie = (feature: any): Movie => {
    let locations = []
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates
      locations = [{
        lat, lng,
        city: feature.properties.location_names[0]?.split(',')[0] || 'Unknown',
        country: feature.properties.location_names[0]?.split(',')[1]?.trim() || 'Unknown',
      }]
    } else if (feature.geometry.type === 'MultiPoint') {
      locations = feature.geometry.coordinates.map((coord: number[], idx: number) => {
        const [lng, lat] = coord
        const locationName = feature.properties.location_names[idx] || 'Unknown'
        const [city, country] = locationName.split(',').map((s: string) => s.trim())
        return { lat, lng, city: city || 'Unknown', country: country || 'Unknown' }
      })
    }

    return {
      movie_id: feature.properties.movie_id,
      title: feature.properties.title,
      year: feature.properties.year,
      imdb_id: feature.properties.movie_id,
      tmdb_id: String(feature.properties.tmdb_id),
      genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
      poster: feature.properties.poster || undefined,
      imdb_rating: feature.properties.imdb_rating || undefined,
      locations,
    }
  }

  /**
   * Load GeoJSON data with caching
   */
  const loadGeoJSON = useCallback(async () => {
    // Return cached data if available
    if (cachedGeoJSON) {
      return cachedGeoJSON
    }

    // Wait for existing fetch if in progress
    if (cachePromise) {
      return cachePromise
    }

    // Start new fetch
    cachePromise = fetch('/geo/movies.geojson')
      .then(res => res.json())
      .then(data => {
        cachedGeoJSON = data
        cachePromise = null
        return data
      })
      .catch(error => {
        cachePromise = null
        throw error
      })

    return cachePromise
  }, [])

  /**
   * Fetch related movies based on genre matching
   */
  const fetchRelatedMovies = useCallback(async (movie: Movie) => {
    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      return
    }

    isFetchingRef.current = true

    try {
      const geojsonData = await loadGeoJSON()

      // Convert to Movie objects
      const allMovies: Movie[] = geojsonData.features.map(convertFeatureToMovie)

      // Find movies with matching genres (exclude current movie)
      const related = allMovies
        .filter(m => m.movie_id !== movie.movie_id)
        .filter(m => {
          const movieGenres = movie.genres || []
          const otherGenres = m.genres || []
          return movieGenres.some(g => otherGenres.includes(g))
        })
        .sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0))
        .slice(0, 6)

      setRelatedMovies(related)
    } catch (error) {
      console.error('Failed to fetch related movies:', error)
      setRelatedMovies([])
    } finally {
      isFetchingRef.current = false
    }
  }, [loadGeoJSON])

  /**
   * Clear related movies
   */
  const clearRelatedMovies = useCallback(() => {
    setRelatedMovies([])
  }, [])

  return {
    relatedMovies,
    fetchRelatedMovies,
    clearRelatedMovies
  }
}
