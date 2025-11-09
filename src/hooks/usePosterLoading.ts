/**
 * Hook for progressive poster loading on the map
 * Loads visible posters as user navigates the map
 */

import { useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONFeature } from '../utils/map/geoJsonHelpers'
import { createPosterIcon } from '../utils/map/markerCreation'

export function usePosterLoading() {
  // Track which poster images have been loaded to prevent redundant loading
  const loadedImagesRef = useRef<Set<string>>(new Set())

  // Cache loaded image elements in memory to avoid re-downloading on refresh
  const imageCacheRef = useRef<{ [key: string]: HTMLImageElement }>({})

  /**
   * Load posters for visible markers on the map
   */
  const loadVisiblePosters = useCallback(async (
    map: maplibregl.Map,
    allFeatures: GeoJSONFeature[],
    fallbackIconName: string
  ): Promise<string[]> => {
    if (!map) return []

    // Get visible features on the map
    const visibleFeatures = map.queryRenderedFeatures({ layers: ['movie-markers'] })

    if (visibleFeatures.length === 0) return []

    // Deduplicate by movie_id
    const uniqueMovieIds = new Set<string>()
    visibleFeatures.forEach(f => {
      if (f.properties?.movie_id) {
        uniqueMovieIds.add(f.properties.movie_id)
      }
    })

    // Load all visible posters in parallel (smooth, no flicker)
    const loadPromises = Array.from(uniqueMovieIds).map(async (movieId) => {
      const iconName = `poster-${movieId}`

      // Skip if already loaded
      if (loadedImagesRef.current.has(iconName) || map.hasImage(iconName)) {
        return null
      }

      // Find the feature to get poster path
      const feature = allFeatures.find(f => f.properties.movie_id === movieId)
      if (!feature) return null

      // Use optimized thumbnail if available, fallback to poster
      const imagePath = feature.properties.thumbnail_52 || feature.properties.poster
      const isMultiLocation = feature.properties.locations_count > 1

      try {
        const posterIcon = await createPosterIcon(imagePath, movieId, isMultiLocation, imageCacheRef.current)
        if (map && !map.hasImage(iconName)) {
          map.addImage(iconName, posterIcon)
          loadedImagesRef.current.add(iconName)
          return movieId
        }
      } catch (error) {
        // Silently fail - will use fallback icon
      }
      return null
    })

    // Wait for all to complete
    const results = await Promise.allSettled(loadPromises)

    // Collect all successfully loaded IDs
    const loadedMovieIds: string[] = []
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        loadedMovieIds.push(result.value)
      }
    })

    // Build expression with ALL loaded icons (both new and previously loaded)
    if (map && map.getLayer('movie-markers')) {
      // Get ALL movie IDs that have loaded icons from our cache
      // This preserves icons across data updates and reset view
      const allLoadedMovieIds = Array.from(loadedImagesRef.current)
        .map(iconName => iconName.replace('poster-', ''))
        .filter(movieId => {
          const iconName = `poster-${movieId}`
          return map.hasImage(iconName)
        })

      if (allLoadedMovieIds.length > 0) {
        const iconExpression: any = [
          'case',
          ['in', ['get', 'movie_id'], ['literal', allLoadedMovieIds]],
          ['concat', 'poster-', ['get', 'movie_id']],
          fallbackIconName
        ]
        map.setLayoutProperty('movie-markers', 'icon-image', iconExpression)
      }
    }

    return loadedMovieIds
  }, [])

  /**
   * Clear the image cache (useful for cleanup)
   */
  const clearCache = useCallback(() => {
    loadedImagesRef.current.clear()
    imageCacheRef.current = {}
  }, [])

  return {
    loadVisiblePosters,
    clearCache,
    loadedImagesRef,
    imageCacheRef
  }
}
