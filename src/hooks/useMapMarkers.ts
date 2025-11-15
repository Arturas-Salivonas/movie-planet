/**
 * Hook for managing map markers - initialization, filtering, and updates
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import type { Movie, FilterState } from '../types'
import type { GeoJSONFeature } from '../utils/map/geoJsonHelpers'
import { convertFeatureToMovie, createGeoJSONCollection } from '../utils/map/geoJsonHelpers'
import { applySpiralOffset, flattenMultiPointFeatures } from '../utils/map/coordinateUtils'
import { createPosterIcon } from '../utils/map/markerCreation'
import { usePosterLoading } from './usePosterLoading'
// import { useClickableRegions } from './useClickableRegions' // DISABLED: Not showing regions on globe
import { useMarkerInteractions } from './useMarkerInteractions'
import { filterMovies } from '../utils/helpers'

interface UseMapMarkersProps {
  map: React.MutableRefObject<maplibregl.Map | null>
  onMovieSelect: (movie: Movie | null) => void
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
  convertGeoJSONToMovie?: (feature: any) => Promise<Movie>
}

export function useMapMarkers({
  map,
  onMovieSelect,
  filters,
  focusedMovieId,
  onClearFocus,
  convertGeoJSONToMovie
}: UseMapMarkersProps) {
  const [movies, setMovies] = useState<Movie[]>([])
  const [geojsonFeatures, setGeojsonFeatures] = useState<GeoJSONFeature[]>([])
  const [loadingState, setLoadingState] = useState({
    isLoading: true,
    progress: 0,
    stage: 'Initializing...'
  })
  const initializedRef = useRef<boolean>(false)

  const { loadVisiblePosters, imageCacheRef } = usePosterLoading()
  // const { addClickableRegions, setupRegionHover, setupRegionClick } = useClickableRegions() // DISABLED
  const { setupMarkerClick, setupMarkerHover } = useMarkerInteractions({
    geojsonFeatures,
    onMovieSelect,
    focusedMovieId,
    onClearFocus,
    convertGeoJSONToMovie
  })

  /**
   * Load movies data and GeoJSON
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        const geojsonResponse = await fetch('/geo/movies.geojson')
        const geojsonData = await geojsonResponse.json()

        setGeojsonFeatures(geojsonData.features)

        const moviesFromGeoJSON: Movie[] = geojsonData.features.map(convertFeatureToMovie)
        setMovies(moviesFromGeoJSON)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
  }, [])

  /**
   * Initialize markers on the map
   */
  const initializeMarkers = useCallback(async () => {
    if (!map.current || geojsonFeatures.length === 0 || movies.length === 0) return
    if (initializedRef.current || map.current.getSource('movies')) return

    // Apply filters to initial data
    const filteredMovies = filterMovies(movies, filters)
    const filteredIds = new Set(filteredMovies.map(m => m.movie_id))
    const allFeatures = geojsonFeatures.filter(f => filteredIds.has(f.properties.movie_id))

    // Convert MultiPoint features into individual Point features
    let displayFeatures = flattenMultiPointFeatures(allFeatures)

    // Apply spiral offset to overlapping markers
    displayFeatures = applySpiralOffset(displayFeatures)

    // Create GeoJSON for display
    const geojson = createGeoJSONCollection(displayFeatures)

    // Show loading state
    if (!initializedRef.current) {
      setLoadingState({
        isLoading: true,
        progress: 50,
        stage: 'Preparing globe...'
      })
    }

    // Create fallback icon
    const fallbackIconName = 'poster-fallback'
    try {
      if (!map.current.hasImage(fallbackIconName)) {
        const fallbackIcon = await createPosterIcon(null, 'fallback', false, imageCacheRef.current)
        map.current.addImage(fallbackIconName, fallbackIcon)
      }
    } catch (error) {
      // Image might already exist from previous render (React strict mode)
      console.debug('Fallback icon already exists, skipping creation')
    }

    // Add source and layer with fallback icons
    try {
      if (!map.current.getSource('movies')) {
        map.current.addSource('movies', {
          type: 'geojson',
          data: geojson,
          cluster: false,
        })
      }
    } catch (error) {
      // Source might already exist from previous render (React strict mode)
      console.debug('Movies source already exists, skipping creation')
    }

    map.current.addLayer({
      id: 'movie-markers',
      type: 'symbol',
      source: 'movies',
      layout: {
        'icon-image': fallbackIconName,
        'icon-size': 0.7,
        'icon-allow-overlap': true,
        'text-field': ['get', 'title'],
        'text-font': ['Arial Unicode MS Bold', 'Arial Unicode MS Regular'],
        'text-size': 14,
        'text-offset': [0, 1.25],
        'text-anchor': 'top',
        'text-max-width': 12,
        'text-allow-overlap': false,
        'text-optional': true
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000ff', // Red background effect
        'text-halo-width': 3, // Larger halo creates background effect
        'text-halo-blur': 1,
        'icon-opacity': 1.0
      }
    })

    // Add clickable regions - DISABLED: Regions still exist but not displayed on globe
    // await addClickableRegions(map.current)
    // setupRegionHover(map.current)
    // setupRegionClick(map.current)

    // Hide loading screen
    if (!initializedRef.current) {
      setTimeout(() => {
        setLoadingState({ isLoading: false, progress: 100, stage: 'Complete' })
        initializedRef.current = true
      }, 300)
    }

    // Setup lazy loading of posters
    const loadPosters = async () => {
      if (!map.current) return
      await loadVisiblePosters(map.current, allFeatures, fallbackIconName)
    }

    loadPosters()

    let loadTimeout: NodeJS.Timeout
    const handleMapIdle = () => {
      clearTimeout(loadTimeout)
      loadTimeout = setTimeout(loadPosters, 100)
    }

    map.current.on('idle', handleMapIdle)

    // Setup interactions
    setupMarkerClick(map.current)
    setupMarkerHover(map.current)
  }, [
    map,
    geojsonFeatures,
    movies,
    filters,
    imageCacheRef,
    loadVisiblePosters,
    // addClickableRegions, // DISABLED
    // setupRegionHover, // DISABLED
    // setupRegionClick, // DISABLED
    setupMarkerClick,
    setupMarkerHover
  ])

  /**
   * Initialize markers when data is loaded
   */
  useEffect(() => {
    if (!map.current || geojsonFeatures.length === 0 || movies.length === 0) return

    if (!map.current.isStyleLoaded()) {
      map.current.on('load', () => {
        initializeMarkers()
      })
    } else {
      initializeMarkers()
    }
  }, [map, geojsonFeatures, movies, initializeMarkers])

  /**
   * Update visible markers based on filters and focus
   */
  useEffect(() => {
    if (!map.current || !map.current.getSource('movies')) return

    let filteredFeatures: GeoJSONFeature[]

    if (focusedMovieId) {
      filteredFeatures = geojsonFeatures.filter(f => f.properties.movie_id === focusedMovieId)
    } else {
      // Only apply filters if movies have been loaded
      if (movies.length > 0) {
        const filteredMovies = filterMovies(movies, filters)
        const filteredIds = new Set(filteredMovies.map(m => m.movie_id))
        filteredFeatures = geojsonFeatures.filter(f => filteredIds.has(f.properties.movie_id))
      } else {
        // Movies not loaded yet, show empty array to avoid showing all markers
        filteredFeatures = []
      }
    }

    // Convert and update
    let displayFeatures = flattenMultiPointFeatures(filteredFeatures)
    const geojson = createGeoJSONCollection(displayFeatures)

    const source = map.current.getSource('movies') as maplibregl.GeoJSONSource
    if (source && source.setData) {
      source.setData(geojson)

      // Reload posters after data update to ensure icons are displayed
      setTimeout(async () => {
        if (map.current && initializedRef.current) {
          await loadVisiblePosters(map.current, geojsonFeatures, 'poster-fallback')
        }
      }, 100)
    }
  }, [map, geojsonFeatures, movies, filters, focusedMovieId, loadVisiblePosters, initializedRef])

  /**
   * Clear connecting lines when focus is removed
   */
  useEffect(() => {
    if (!map.current) return

    if (!focusedMovieId) {
      if (map.current.getLayer('connecting-line')) {
        map.current.removeLayer('connecting-line')
      }
      if (map.current.getSource('connecting-line')) {
        map.current.removeSource('connecting-line')
      }
    }
  }, [map, focusedMovieId])

  return {
    movies,
    geojsonFeatures,
    loadingState,
    initializedRef
  }
}
