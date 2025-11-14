/**
 * Hook for managing movie navigation and URL sync
 * Handles URL params, slug mapping, and browser history
 * OPTIMIZED: Caches GeoJSON data to prevent repeated fetches
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Movie } from '../types'

interface UseMovieNavigationProps {
  initialMovie?: Movie | null
}

// Global cache for GeoJSON data (shared across component instances)
let cachedGeoJSON: any = null
let cachePromise: Promise<any> | null = null

export function useMovieNavigation({ initialMovie }: UseMovieNavigationProps) {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(initialMovie || null)
  const [slugMap, setSlugMap] = useState<Record<string, string>>({})
  const [reverseSlugMap, setReverseSlugMap] = useState<Record<string, string>>({})
  const isFetchingRef = useRef(false)

  // Load slug mappings
  useEffect(() => {
    // Load reverse slug mapping (movie_id -> slug)
    fetch('/data/movies_slugs_reverse.json')
      .then(res => res.json())
      .then(data => setSlugMap(data))
      .catch(err => console.error('Failed to load slug mapping:', err))

    // Load forward slug mapping (slug -> movie_id)
    fetch('/data/movies_slugs.json')
      .then(res => res.json())
      .then(data => setReverseSlugMap(data))
      .catch(err => console.error('Failed to load forward slug mapping:', err))
  }, [])

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
   * Convert GeoJSON feature to Movie object with full location data
   * ENHANCED: Loads full movie data from movies_enriched.json to get scene descriptions
   */
  const convertGeoJSONToMovie = useCallback(async (feature: any): Promise<Movie> => {
    // Try to load full movie data from movies_enriched.json
    try {
      const response = await fetch('/data/movies_enriched.json')
      const allMovies = await response.json()
      const fullMovie = allMovies.find((m: any) => m.imdb_id === feature.properties.movie_id)

      if (fullMovie) {
        // Return full movie data with all location details including scene_description
        return {
          movie_id: fullMovie.imdb_id,
          title: fullMovie.title,
          year: fullMovie.year,
          imdb_id: fullMovie.imdb_id,
          tmdb_id: String(fullMovie.tmdb_id),
          type: fullMovie.type || 'movie',
          genres: fullMovie.genres || [],
          poster: fullMovie.poster || undefined,
          thumbnail_52: fullMovie.thumbnail_52 || undefined,
          banner_1280: fullMovie.banner_1280 || undefined,
          trailer: fullMovie.trailer || undefined,
          imdb_rating: fullMovie.imdb_rating || undefined,
          locations: fullMovie.locations || [], // Full location data with scene_description
        }
      }
    } catch (error) {
      console.error('Failed to load full movie data, falling back to GeoJSON:', error)
    }

    // Fallback to GeoJSON data (without scene descriptions)
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
  }, [])

  /**
   * Handle URL changes (back/forward navigation)
   */
  useEffect(() => {
    const handleUrlChange = async () => {
      // Prevent duplicate fetches
      if (isFetchingRef.current) {
        return
      }

      const params = new URLSearchParams(window.location.search)
      const movieSlug = params.get('movie')

      if (movieSlug && Object.keys(reverseSlugMap).length > 0) {
        const movieId = reverseSlugMap[movieSlug]
        if (movieId) {
          // Only fetch if we don't already have this movie selected
          if (selectedMovie?.movie_id === movieId) {
            return
          }

          isFetchingRef.current = true

          try {
            const geojsonData = await loadGeoJSON()
            const feature = geojsonData.features.find((f: any) => f.properties.movie_id === movieId)

            if (feature) {
              const movie = await convertGeoJSONToMovie(feature) // AWAIT here
              setSelectedMovie(movie)
            }
          } catch (error) {
            console.error('Failed to load movie:', error)
          } finally {
            isFetchingRef.current = false
          }
        }
      } else if (!movieSlug && selectedMovie) {
        setSelectedMovie(null)
      }
    }

    handleUrlChange()

    window.addEventListener('popstate', handleUrlChange)
    return () => window.removeEventListener('popstate', handleUrlChange)
  }, [reverseSlugMap, convertGeoJSONToMovie, loadGeoJSON]) // Removed selectedMovie from dependencies

  /**
   * Handle movie selection and URL updates
   */
  const handleMovieSelect = useCallback(async (movie: Movie | null) => {
    if (movie) {
      const slug = slugMap[movie.movie_id]
      if (slug) {
        const url = new URL(window.location.href)
        url.searchParams.set('movie', slug)
        window.history.pushState({}, '', url.toString())

        // Load full movie data with scenes from movies_enriched.json
        try {
          const geojsonData = await loadGeoJSON()
          const feature = geojsonData.features.find((f: any) => f.properties.movie_id === movie.movie_id)

          if (feature) {
            const fullMovie = await convertGeoJSONToMovie(feature)

            // PRESERVE clickedLocationIndex from the original movie object
            const movieWithClickedIndex = {
              ...fullMovie,
              clickedLocationIndex: movie.clickedLocationIndex
            }

            setSelectedMovie(movieWithClickedIndex)
          } else {
            // Fallback to provided movie if feature not found
            setSelectedMovie(movie)
          }
        } catch (error) {
          console.error('Failed to load full movie data in handleMovieSelect:', error)
          setSelectedMovie(movie)
        }
      } else {
        console.error('No slug found for movie:', movie.movie_id)
      }
    } else {
      setSelectedMovie(null)
      const url = new URL(window.location.href)
      url.searchParams.delete('movie')
      window.history.pushState({}, '', url.toString())
    }
  }, [slugMap, loadGeoJSON, convertGeoJSONToMovie])

  /**
   * Close modal and clear URL params
   */
  const closeModal = useCallback(() => {
    setSelectedMovie(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('movie')
    window.history.pushState({}, '', url.toString())
  }, [])

  return {
    selectedMovie,
    handleMovieSelect,
    closeModal,
    convertGeoJSONToMovie
  }
}
