'use client'

/**
 * Map Component - MapLibre GL JS map with globe projection and multi-location support
 * Updated for Next.js - no hash routing, uses localStorage for map state
 */

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Movie, FilterState, Location } from '../types'
import { filterMovies } from '../utils/helpers'

interface MapProps {
  selectedMovie: Movie | null
  onMovieSelect: (movie: Movie | null) => void
  searchQuery: string
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
}

export interface MapRef {
  showAllLocationsForMovie: (movie: Movie) => void
  flyToLocation: (lat: number, lng: number) => void
  resetView: () => void
}

interface GeoJSONFeature {
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
    thumbnail_52?: string | null // Optimized 52x52 thumbnail
    banner_1280?: string | null // 1280x720 banner
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

const Map = forwardRef<MapRef, MapProps>(({
  selectedMovie,
  onMovieSelect,
  searchQuery: _searchQuery,
  filters,
  focusedMovieId,
  onClearFocus,
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [geojsonFeatures, setGeojsonFeatures] = useState<GeoJSONFeature[]>([])
  const initializedRef = useRef<boolean>(false)

  // Track which poster images have been loaded to prevent redundant loading
  const loadedImagesRef = useRef<Set<string>>(new Set())

  // Cache loaded image elements in memory to avoid re-downloading on refresh
  const imageCacheRef = useRef<{ [key: string]: HTMLImageElement }>({})

  // Loading state for progressive rendering
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean
    progress: number
    stage: string
  }>({
    isLoading: true,
    progress: 0,
    stage: 'Initializing...'
  })

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    showAllLocationsForMovie: (movie: Movie) => {
      if (!map.current) {
        return
      }

      const feature = geojsonFeatures.find(f => f.properties.movie_id === movie.movie_id)
      if (!feature) {
        return
      }

      const coordinates = feature.geometry.type === 'MultiPoint'
        ? feature.geometry.coordinates as number[][]
        : [feature.geometry.coordinates as number[]]

      // Calculate bounds
      const bounds = new maplibregl.LngLatBounds()
      coordinates.forEach(coord => bounds.extend(coord as [number, number]))

      // Fit map to bounds
      map.current.fitBounds(bounds, {
        padding: 100,
        maxZoom: 10,
        duration: 1000
      })

      // Remove existing connecting line
      if (map.current.getLayer('connecting-line')) {
        map.current.removeLayer('connecting-line')
      }
      if (map.current.getSource('connecting-line')) {
        map.current.removeSource('connecting-line')
      }

      // Draw connecting polyline for multi-location movies
      if (coordinates.length > 1) {
        map.current.addSource('connecting-line', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates
            },
            properties: {}
          }
        })

        map.current.addLayer({
          id: 'connecting-line',
          type: 'line',
          source: 'connecting-line',
          paint: {
            'line-color': '#06b82aff',
            'line-width': 4,
            'line-opacity': 0.9,
            'line-blur': 1
          }
        })
      }
    },
    flyToLocation: (lat: number, lng: number) => {
      if (map.current) {
        const targetZoom = 12

        // Temporarily switch to mercator projection for accurate positioning
        ;(map.current as any).setProjection({ type: 'mercator' })

        // Use flyTo for smooth animation in mercator with faster duration
        map.current.flyTo({
          center: [lng, lat],
          zoom: targetZoom,
          duration: 1200,
          essential: true
        })

        // Wait for mercator animation to complete, then switch to globe
        setTimeout(() => {
          if (!map.current) return

          // Switch back to globe projection
          ;(map.current as any).setProjection({ type: 'globe' })

          // Re-apply center and zoom after globe switch with easeTo for smooth transition
          map.current.easeTo({
            center: [lng, lat],
            zoom: targetZoom,
            duration: 600,
            essential: true
          })
        }, 1300)
      }
    },
    resetView: () => {
      if (map.current) {
        // Remove debug marker if exists
        if (map.current.getSource('debug-marker')) {
          map.current.removeLayer('debug-marker')
          map.current.removeSource('debug-marker')
        }

        // Remove connecting line if exists
        if (map.current.getLayer('connecting-line')) {
          map.current.removeLayer('connecting-line')
        }
        if (map.current.getSource('connecting-line')) {
          map.current.removeSource('connecting-line')
        }

        // Reset to default view (Europe centered)
        map.current.flyTo({
          center: [0.35, 43],
          zoom: 3, // Match the default starting zoom
          duration: 1500,
          essential: true
        })
      }
    }
  }), [geojsonFeatures])

  /**
   * Convert GeoJSON feature to Movie object
   */
  const convertFeatureToMovie = (feature: GeoJSONFeature): Movie => {
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
   * Load movies data and GeoJSON with progressive loading
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load GeoJSON features
        const geojsonResponse = await fetch('/geo/movies.geojson')
        const geojsonData = await geojsonResponse.json()

        // Store all features for filtering
        setGeojsonFeatures(geojsonData.features)

        // Convert all GeoJSON features to Movie objects
        const moviesFromGeoJSON: Movie[] = geojsonData.features.map(convertFeatureToMovie)
        setMovies(moviesFromGeoJSON)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
  }, [])

  /**
   * Initialize map
   */
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      // Use custom grey style for minimalist look
      // Alternative: use '/styles/custom-grey.json' for full custom control
      style: 'https://api.maptiler.com/maps/streets-v4/style.json?key=q4aOhsVX264foFexJ7ga',
      zoom: 3, // Lower = more zoomed out (default starting zoom)
      center: [0.35, 43], // Centered on Europe
      // hash: true // Removed for Next.js - using localStorage for clean URLs
      // Performance optimizations for smooth 60fps
      maxPitch: 85, // Limit pitch for better performance
      refreshExpiredTiles: false, // Don't reload tiles unnecessarily
      fadeDuration: 150 // Faster fade for smoother feel (default 300ms)
    })

    map.current.on('style.load', () => {
      if (map.current) {
        // Set projection to globe
        (map.current as any).setProjection({
          type: 'globe',
        })

        // ⚠️ IMPORTANT: Don't restore zoom from localStorage on first load
        // This was overriding the default zoom setting above
        // Only restore center position if user wants to continue where they left off
        if (typeof window !== 'undefined') {
          const savedState = localStorage.getItem('filmingmap_view')
          if (savedState) {
            try {
              const { lat, lng } = JSON.parse(savedState)
              // Only restore center, not zoom - let default zoom take effect
              map.current.setCenter([lng, lat])
            } catch (e) {
              // Ignore invalid stored state
            }
          }
        }
      }
    })

    // Save map position to localStorage on movement (debounced)
    let saveTimeout: NodeJS.Timeout | null = null
    const saveMapState = () => {
      if (!map.current || typeof window === 'undefined') return
      const center = map.current.getCenter()
      const zoom = map.current.getZoom()
      localStorage.setItem('filmingmap_view', JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        zoom: zoom
      }))
    }

    map.current.on('moveend', () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveMapState, 500)
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.current.addControl(new maplibregl.FullscreenControl(), 'bottom-right')

    // Don't add zoom listener here - it causes issues with tile loading
    // We'll handle it differently

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  /**
   * Load and create poster image icon with movie badge
   * NOW WITH BROWSER CACHE SUPPORT
   */
  const createPosterIcon = async (posterPath: string | null, movieId: string, _isMultiLocation: boolean): Promise<{ width: number; height: number; data: Uint8ClampedArray }> => {
    return new Promise((resolve) => {
      const size = 52 // Slightly larger for better visibility
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!

      // If no poster, create fallback icon
      if (!posterPath) {
        // Add outer glow/shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4

        // Create circular background with gradient
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
        gradient.addColorStop(0, '#2a2a2a')
        gradient.addColorStop(1, '#1a1a1a')

        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Reset shadow for border
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        // Gold border with slight glow
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 3
        ctx.stroke()

        // Inner gold glow
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'
        ctx.lineWidth = 2
        ctx.stroke()

        // Film icon
        ctx.fillStyle = '#FFD700'
        ctx.font = 'bold 24px Arial Unicode MS Bold'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎬', size / 2, size / 2)

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
        return
      }

      // Check if image is already cached in memory
      if (imageCacheRef.current[movieId]) {
        const cachedImg = imageCacheRef.current[movieId]

        // FAST PATH: Reuse cached image with minimal canvas operations
        ctx.save()

        // Add shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 4

        // Clip and draw
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(cachedImg, 0, 0, size, size)
        ctx.restore()

        // Border (no shadow for speed)
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 3
        ctx.stroke()

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
        return
      }      // Load poster image with browser caching
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // Cache the loaded image for reuse
        imageCacheRef.current[movieId] = img

        // Add outer shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4

        // Create circular clipping mask
        ctx.save()
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.clip()

        // Draw poster (centered and scaled)
        ctx.drawImage(img, 0, 0, size, size)
        ctx.restore()

        // Reset shadow for border
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        // Gold border around circle
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 3
        ctx.stroke()

        // Inner gold glow for depth
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)'
        ctx.lineWidth = 1
        ctx.stroke()

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
      }

      img.onerror = () => {
        // Add outer glow/shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4

        // Fallback on error - circular icon with gradient
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
        gradient.addColorStop(0, '#2a2a2a')
        gradient.addColorStop(1, '#1a1a1a')

        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Reset shadow
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        // Gold border
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 3
        ctx.stroke()

        // Inner glow
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'
        ctx.lineWidth = 2
        ctx.stroke()

        // Film icon fallback
        ctx.fillStyle = '#FFD700'
        ctx.font = 'bold 22px Arial Unicode MS Bold'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎬', size / 2, size / 2)

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
      }

      // Use the full poster URL from the data - browser will cache it
      img.src = posterPath
    })
  }

  /**
   * Add movie markers from GeoJSON - INITIAL LOAD ONLY
   */
  useEffect(() => {
    if (!map.current || geojsonFeatures.length === 0) return

    // Only run this effect once when data is first loaded
    if (initializedRef.current || map.current.getSource('movies')) return

    async function initializeMarkers() {
      if (!map.current) return

      const allFeatures = geojsonFeatures

      // Convert MultiPoint features into individual Point features for each location
      const displayFeatures: any[] = []

      allFeatures.forEach(feature => {
        if (feature.geometry.type === 'MultiPoint') {
          // Create a separate feature for each location
          const coords = feature.geometry.coordinates as number[][]
          coords.forEach((coord, index) => {
            displayFeatures.push({
              ...feature,
              id: `${feature.id}-loc-${index}`,
              geometry: {
                type: 'Point' as const,
                coordinates: coord
              }
            })
          })
        } else {
          // Single location - keep as is
          displayFeatures.push(feature)
        }
      })

      // ✨ SMART OFFSET: Detect overlapping markers and apply spiral offset
      const OVERLAP_THRESHOLD = 0.0005 // ~100m in degrees (adjust for sensitivity)
      const locationGroups: { [key: string]: typeof displayFeatures } = {}

      // Group features by approximate location
      displayFeatures.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates
        const gridKey = `${Math.round(lng / OVERLAP_THRESHOLD)}_${Math.round(lat / OVERLAP_THRESHOLD)}`

        if (!locationGroups[gridKey]) {
          locationGroups[gridKey] = []
        }
        locationGroups[gridKey].push(feature)
      })

      // Apply spiral offset to overlapping markers
      const processedFeatures: any[] = []
      Object.values(locationGroups).forEach((group: typeof displayFeatures) => {
        if (group.length === 1) {
          // No overlap - keep original position
          processedFeatures.push(group[0])
        } else {
          // Multiple markers at same location - apply spiral offset
          group.forEach((feature: any, index: number) => {
            const angle = (index / group.length) * 2 * Math.PI
            const radius = 0.0005 + (Math.floor(index / 8) * 0.0003) // Spiral outward
            const offsetLng = Math.cos(angle) * radius
            const offsetLat = Math.sin(angle) * radius

            const [lng, lat] = feature.geometry.coordinates
            processedFeatures.push({
              ...feature,
              geometry: {
                type: 'Point' as const,
                coordinates: [lng + offsetLng, lat + offsetLat]
              },
              properties: {
                ...feature.properties,
                _overlapping_count: group.length, // Track overlap count
                _overlap_index: index
              }
            })
          })
        }
      })

      // Create GeoJSON for display with offset markers
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: processedFeatures as any
      }

      // ✨ STEP 1: Show loading state
      if (!initializedRef.current) {
        setLoadingState({
          isLoading: true,
          progress: 50,
          stage: 'Preparing globe...'
        })
      }

      // ✨ STEP 2: Create default fallback icon FIRST
      const fallbackIconName = 'poster-fallback'
      if (!map.current!.hasImage(fallbackIconName)) {
        const fallbackIcon = await createPosterIcon(null, 'fallback', false)
        map.current!.addImage(fallbackIconName, fallbackIcon)
      }

      // ✨ STEP 3: Add source and layer immediately with fallback icons
      map.current!.addSource('movies', {
        type: 'geojson',
        data: geojson,
        cluster: false,
      })

      map.current!.addLayer({
        id: 'movie-markers',
        type: 'symbol',
        source: 'movies',
        layout: {
          // Start with fallback icon for all markers
          'icon-image': fallbackIconName,
          'icon-size': 0.9,
          'icon-allow-overlap': true,
          'text-field': ['get', 'title'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 14,
          'text-offset': [0, 2.0],
          'text-anchor': 'top',
          'text-max-width': 12,
          'text-allow-overlap': false,
          'text-optional': true
        },
        paint: {
          'text-color': '#FFD700',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-halo-blur': 1,
          // Performance: Only show text when zoomed in (completely hidden below zoom 3)
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, 0,     // Completely hidden when zoomed out
            3, 0,     // Still hidden
            4, 0.5,   // Start fading in
            5, 1      // Full opacity when zoomed in close
          ]
        }
      })

      // ✨ STEP 4: Hide loading screen immediately - globe is now visible with skeleton markers!
      if (!initializedRef.current) {
        setTimeout(() => {
          setLoadingState({ isLoading: false, progress: 100, stage: 'Complete' })
          initializedRef.current = true
        }, 300)
      }

      // ✨ STEP 5: SMART LAZY LOADING - Only load posters in viewport
      // Smooth loading - single update to avoid flickering
      const loadedMovieIds = new Set<string>()

      const loadVisiblePosters = async () => {
        if (!map.current) return

        // Get visible features on the map
        const visibleFeatures = map.current.queryRenderedFeatures({ layers: ['movie-markers'] })

        if (visibleFeatures.length === 0) return

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
          if (loadedImagesRef.current.has(iconName) || map.current!.hasImage(iconName)) {
            return null
          }

          // Find the feature to get poster path
          const feature = allFeatures.find(f => f.properties.movie_id === movieId)
          if (!feature) return null

          // Use optimized thumbnail if available, fallback to poster
          const imagePath = feature.properties.thumbnail_52 || feature.properties.poster
          const isMultiLocation = feature.properties.locations_count > 1

          try {
            const posterIcon = await createPosterIcon(imagePath, movieId, isMultiLocation)
            if (map.current && !map.current.hasImage(iconName)) {
              map.current.addImage(iconName, posterIcon)
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
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            loadedMovieIds.add(result.value)
          }
        })

        // Single smooth update after all posters loaded (no flickering!)
        if (map.current && map.current.getLayer('movie-markers') && loadedMovieIds.size > 0) {
          const iconExpression: any = [
            'case',
            ['in', ['get', 'movie_id'], ['literal', Array.from(loadedMovieIds)]],
            ['concat', 'poster-', ['get', 'movie_id']],
            fallbackIconName
          ]
          map.current.setLayoutProperty('movie-markers', 'icon-image', iconExpression)
        }
      }

      // Start loading visible posters immediately
      loadVisiblePosters()

      // Load more posters when user moves/zooms the map
      // Use 'idle' event instead of 'moveend' for better performance (fires after animations complete)
      let loadTimeout: NodeJS.Timeout
      const handleMapIdle = () => {
        clearTimeout(loadTimeout)
        loadTimeout = setTimeout(() => {
          loadVisiblePosters()
        }, 100) // Quick debounce - just enough to avoid redundant calls
      }

      map.current!.on('idle', handleMapIdle)

      // Add unified click handler for all movie markers with overlap detection
      let lastClickedLocation: string | null = null
      let clickCycleIndex = 0

      const handleMarkerClick = (e: any) => {
        if (!e.features || e.features.length === 0) return

        // Get all features at click point (overlapping markers)
        const clickedFeatures = map.current!.queryRenderedFeatures(e.point, {
          layers: ['movie-markers']
        })

        if (clickedFeatures.length === 0) return

        // Create location key for this click
        const firstFeature = clickedFeatures[0]
        const [lng, lat] = firstFeature.geometry.type === 'Point'
          ? (firstFeature.geometry as any).coordinates
          : [0, 0]
        const locationKey = `${lng.toFixed(4)}_${lat.toFixed(4)}`

        // Check if clicking same location again (cycle through)
        if (lastClickedLocation === locationKey && clickedFeatures.length > 1) {
          clickCycleIndex = (clickCycleIndex + 1) % clickedFeatures.length
        } else {
          // New location - reset cycle
          lastClickedLocation = locationKey
          clickCycleIndex = 0
        }

        const feature = clickedFeatures[clickCycleIndex]

        // Try to find in geojsonFeatures by movie_id
        const featureByMovieId = geojsonFeatures.find(f => f.properties.movie_id === feature.properties.movie_id)

        if (featureByMovieId) {
          const movieFromFeature = convertFeatureToMovie(featureByMovieId)
          onMovieSelect(movieFromFeature)
          // Don't automatically show all locations - let user click "Show All on Map" button
        } else {
          // Last resort: create a minimal movie object
          const movieFromClick = {
            movie_id: feature.properties.movie_id,
            title: feature.properties.title,
            year: feature.properties.year,
            imdb_id: feature.properties.movie_id,
            tmdb_id: String(feature.properties.tmdb_id),
            genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
            poster: feature.properties.poster || undefined,
            trailer: feature.properties.trailer || undefined,
            imdb_rating: feature.properties.imdb_rating || undefined,
            locations: [{
              lat: 0,
              lng: 0,
              city: 'Unknown',
              country: 'Unknown',
            }], // Minimal location to prevent crash
          }
          onMovieSelect(movieFromClick as Movie)
        }
      }

      map.current!.on('click', 'movie-markers', handleMarkerClick)

      // Clear focus when clicking on empty map (not on markers)
      const handleMapClick = (e: any) => {
        // Only clear focus if clicking on empty space (not on markers)
        if (!e.features || e.features.length === 0) {
          if (focusedMovieId && onClearFocus) {
            onClearFocus()
          }
        }
      }

      map.current!.on('click', handleMapClick)

      // Enhanced hover tooltip - ALWAYS shows, better styling, more intuitive
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 25,
        className: 'movie-marker-popup',
        maxWidth: 'none' // Allow custom width
      })

      map.current!.on('mouseenter', 'movie-markers', (e: any) => {
        map.current!.getCanvas().style.cursor = 'pointer'

        // Get ALL features at this point (overlapping markers)
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['movie-markers']
        })

        if (features.length === 0) return

        const coordinates = (features[0].geometry as any).coordinates.slice()

        // Always show tooltip, even for single movies
        if (features.length === 1) {
          // Single movie - show hero banner with poster
          const movie = features[0].properties
          const posterUrl = movie.poster || '/images/placeholder-poster.jpg'

          const html = `
            <style>
              .movie-hover-card {
                margin: 0 !important;
                padding: 0 !important;
              }
            </style>
            <div class="movie-hover-card" style="
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              border: 2px solid #FFD700;
              border-radius: 12px;
              overflow: hidden;
              min-width: 280px;
              max-width: 300px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.8);
              margin: 0;
              padding: 0;
            ">
              <!-- Hero Poster Banner -->
              <div style="
                width: 100%;
                height: 140px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7)),
                            url('${posterUrl}');
                background-size: cover;
                background-position: center;
                display: flex;
                align-items: flex-end;
                padding: 12px;
                position: relative;
              ">
                <div style="
                  background: rgba(0,0,0,0.8);
                  backdrop-filter: blur(10px);
                  padding: 8px 12px;
                  border-radius: 8px;
                  border: 1px solid rgba(255,215,0,0.3);
                  width: 100%;
                ">
                  <div style="
                    color: #FFD700;
                    font-weight: bold;
                    font-size: 15px;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                  ">
                     ${movie.title}
                  </div>
                </div>
              </div>

              <!-- Movie Details -->
              <div style="padding: 12px 14px;">
                <div style="
                  color: #e0e0e0;
                  font-size: 13px;
                  margin-bottom: 10px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  flex-wrap: wrap;
                ">
                  <span style="
                    background: rgba(255,215,0,0.2);
                    color: #FFD700;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: bold;
                  ">📅 ${movie.year}</span>
                  ${movie.top_genre ? `
                    <span style="
                      background: rgba(6,184,42,0.2);
                      color: #06b82a;
                      padding: 3px 8px;
                      border-radius: 6px;
                      font-size: 11px;
                      font-weight: bold;
                    ">${movie.top_genre}</span>
                  ` : ''}
                  ${movie.imdb_rating ? `
                    <span style="
                      background: rgba(255,215,0,0.2);
                      color: #FFD700;
                      padding: 3px 8px;
                      border-radius: 6px;
                      font-size: 11px;
                      font-weight: bold;
                    ">⭐ ${movie.imdb_rating}</span>
                  ` : ''}
                </div>
                <div style="
                  color: #FFD700;
                  font-size: 11px;
                  font-weight: bold;
                  padding-top: 10px;
                  border-top: 1px solid #444;
                  text-align: center;
                ">
                   Click to view full details
                </div>
              </div>
            </div>
          `
          popup.setLngLat(coordinates).setHTML(html).addTo(map.current!)
        } else {
          // Multiple movies - show list with enhanced styling
          const movieList = features.slice(0, 6).map((f: any, idx: number) => {
            const movie = f.properties
            return `
              <div style="
                padding: 8px;
                border-radius: 6px;
                background: ${idx % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)'};
                margin: 4px 0;
                transition: background 0.2s;
              ">
                <div style="color: #FFD700; font-weight: bold; font-size: 12px;">
                  ${idx + 1}. ${movie.title}
                </div>
                <div style="color: #999; font-size: 10px; margin-top: 2px;">
                  ${movie.year} ${movie.top_genre ? `• ${movie.top_genre}` : ''}
                </div>
              </div>
            `
          }).join('')

          const moreCount = features.length > 6 ? features.length - 6 : 0

          const html = `
            <div style="
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              border: 3px solid #FF6B6B;
              border-radius: 12px;
              padding: 14px;
              min-width: 280px;
              max-width: 320px;
              box-shadow: 0 12px 48px rgba(255,107,107,0.4);
            ">
              <div style="
                color: #FF6B6B;
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 8px;
                border-bottom: 2px solid #FF6B6B;
              ">
                <span>📍 ${features.length} Movies in this Location!</span>

              </div>
              <div style="max-height: 300px; overflow-y: auto;">
                ${movieList}
                ${moreCount > 0 ? `
                  <div style="
                    text-align: center;
                    color: #FFD700;
                    font-style: italic;
                    margin-top: 8px;
                    padding: 8px;
                    background: rgba(255,215,0,0.1);
                    border-radius: 6px;
                  ">
                    ...and ${moreCount} more
                  </div>
                ` : ''}
              </div>
              <div style="
                 color: #FFD700;
                font-size: 12px;
                font-weight: bold;
                padding-top: 12px;
                margin-top: 12px;
                border-top: 2px solid #444;
                text-align: center;

              ">
               Zoom in to see all movies
              </div>
            </div>
          `
          popup.setLngLat(coordinates).setHTML(html).addTo(map.current!)
        }
      })

      map.current!.on('mouseleave', 'movie-markers', () => {
        map.current!.getCanvas().style.cursor = ''
        popup.remove()
      })
    }

    // Wait for style to be loaded
    if (!map.current.isStyleLoaded()) {
      map.current.on('load', () => {
        initializeMarkers()
      })
    } else {
      initializeMarkers()
    }
  }, [geojsonFeatures]) // Only depend on geojsonFeatures - run once when data loads

  /**
   * Update visible markers based on filters and focus - NO REBUILDING
   */
  useEffect(() => {
    if (!map.current || !map.current.getSource('movies')) return

    let filteredFeatures: GeoJSONFeature[]

    // If a movie is focused, ONLY show that movie's markers (ignore all other filters)
    if (focusedMovieId) {
      filteredFeatures = geojsonFeatures.filter(f => f.properties.movie_id === focusedMovieId)
    } else {
      // Normal mode: apply search and filter logic
      const filteredMovies = filterMovies(movies, filters)
      const filteredIds = new Set(filteredMovies.map(m => m.movie_id))

      filteredFeatures = movies.length > 0
        ? geojsonFeatures.filter(f => filteredIds.has(f.properties.movie_id))
        : geojsonFeatures
    }

    // Convert MultiPoint features into individual Point features
    const displayFeatures: any[] = []

    filteredFeatures.forEach(feature => {
      if (feature.geometry.type === 'MultiPoint') {
        const coords = feature.geometry.coordinates as number[][]
        coords.forEach((coord, index) => {
          displayFeatures.push({
            ...feature,
            id: `${feature.id}-loc-${index}`,
            geometry: {
              type: 'Point' as const,
              coordinates: coord
            }
          })
        })
      } else {
        displayFeatures.push(feature)
      }
    })

    // Update the data source WITHOUT rebuilding layers - INSTANT!
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: displayFeatures as any
    }

    const source = map.current.getSource('movies') as maplibregl.GeoJSONSource
    if (source && source.setData) {
      source.setData(geojson)
    }
  }, [geojsonFeatures, movies, filters, focusedMovieId]) // Update data when filters/focus change

  /**
   * Clear connecting lines when focus is removed
   */
  useEffect(() => {
    if (!map.current) return

    // When focusedMovieId is cleared, remove the connecting lines
    if (!focusedMovieId) {
      if (map.current.getLayer('connecting-line')) {
        map.current.removeLayer('connecting-line')
      }
      if (map.current.getSource('connecting-line')) {
        map.current.removeSource('connecting-line')
      }
    }
  }, [focusedMovieId])

  /**
   * Handle selected movie
   */
  useEffect(() => {
    if (!map.current || !selectedMovie) return

    const bounds = new maplibregl.LngLatBounds()
    selectedMovie.locations.forEach((location) => {
      bounds.extend([location.lng, location.lat])
    })

    map.current.fitBounds(bounds, {
      padding: 100,
      duration: 1000,
    })
  }, [selectedMovie])

  return (
    <div className="map-container">
      {/* Stars background */}
      <div className="stars-background" />

      {/* Map container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />

      {/* Loading Screen Overlay - Only show on initial load */}
      {loadingState.isLoading && !initializedRef.current && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
          <div className="text-center space-y-6 px-8">
            {/* Movie emoji animation */}
            <div className="text-xl animate-bounce">
              <img src="images/logo/filmingmap-logo.webp" alt="filmingmap Logo" className="" />
            </div>



            {/* Loading stage text */}
            <p className="text-xl text-gray-300">
              {loadingState.stage}
            </p>

            {/* Progress bar */}
            <div className="w-80 bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-purple-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>

            {/* Progress percentage */}
            <p className="text-sm text-gray-400 font-mono">
              {Math.round(loadingState.progress)}%
            </p>
          </div>
        </div>
      )}

      {/* Instructions - Left Side (Hidden on Mobile) */}
      <div className="hidden lg:block absolute top-24 left-4 z-10 bg-black/70 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 max-w-xs">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <span>ℹ️</span> How to Use
        </h3>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>🔍 Search for movies or locations</li>
          <li>🗺️ Click markers to explore</li>
          <li>🌐 Rotate & zoom the globe</li>
          <li>🎬 Discover filming locations worldwide</li>
        </ul>
      </div>

      {/* Movie Statistics - Top Right (Hidden on Mobile) */}
      <div className="hidden lg:flex absolute top-24 right-4 z-10 gap-3">
        <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-xl border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <div>
              <p className="text-xs text-gray-300">Movies</p>
              <p className="text-xl font-bold">
                {movies.filter(m => m.type !== 'tv').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-xl border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📺</span>
            <div>
              <p className="text-xs text-gray-300">TV Series</p>
              <p className="text-xl font-bold">
                {movies.filter(m => m.type === 'tv').length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

Map.displayName = 'Map'

export default Map
