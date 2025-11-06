/**
 * Map Component - MapLibre GL JS map with globe projection and multi-location support
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

  // Track which poster images have been loaded to prevent redundant loading
  const loadedImagesRef = useRef<Set<string>>(new Set())

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
      const feature = geojsonFeatures.find(f => f.properties.movie_id === movie.movie_id)
      if (feature) {
        showAllLocations(feature)
      }
    },
    flyToLocation: (lat: number, lng: number) => {
      if (map.current) {
        map.current.flyTo({
          center: [lng, lat],
          zoom: 12,
          duration: 2000,
          essential: true
        })
      }
    }
  }))

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

        console.log(`📊 Loaded ${geojsonData.features.length} movies for progressive rendering`)
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
      // Use MapTiler basic style - free tier, works with globe
      style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
      zoom: 2.88,
      center: [0.35, 43], // Centered on Europe
      hash: true
    })

    // Globe rotation animation
    let isUserInteracting = false
    let rotationAnimation: number | null = null

    const startRotation = () => {
      if (!map.current || isUserInteracting) return

      const rotateCamera = (_timestamp: number) => {
        if (!map.current || isUserInteracting) return

        // Rotate 360 degrees over 2 minutes (120 seconds)
        const secondsPerRevolution = 720
        const center = map.current.getCenter()
        center.lng = (center.lng + (360 / secondsPerRevolution) * (1/60)) % 360
        map.current.setCenter(center)

        rotationAnimation = requestAnimationFrame(rotateCamera)
      }

      rotationAnimation = requestAnimationFrame(rotateCamera)
    }

    const stopRotation = () => {
      isUserInteracting = true
      if (rotationAnimation !== null) {
        cancelAnimationFrame(rotationAnimation)
        rotationAnimation = null
      }
    }

    map.current.on('style.load', () => {
      if (map.current) {
        // Set projection to globe
        (map.current as any).setProjection({
          type: 'globe',
        })

        // Start rotation after map loads
        setTimeout(startRotation, 1000)
      }
    })

    // Stop rotation on any user interaction
    map.current.on('mousedown', stopRotation)
    map.current.on('touchstart', stopRotation)
    map.current.on('wheel', stopRotation)
    map.current.on('dragstart', stopRotation)

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
   */
  const createPosterIcon = async (posterPath: string | null, _movieId: string, _isMultiLocation: boolean): Promise<{ width: number; height: number; data: Uint8ClampedArray }> => {
    return new Promise((resolve) => {
      const size = 60 // Consistent size for all markers
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!

      // If no poster, create fallback icon
      if (!posterPath) {
        // Create circular background
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.fillStyle = '#3B82F6'
        ctx.fill()

        // White border
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 3
        ctx.stroke()

        // Film icon
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎬', size / 2, size / 2)

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
        return
      }

      // Load poster image
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // Create circular clipping mask
        ctx.save()
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()

        // Draw poster (centered and scaled)
        ctx.drawImage(img, 0, 0, size, size)
        ctx.restore()

        // White border around circle
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.strokeStyle = '#10be50ff'
        ctx.lineWidth = 3
        ctx.stroke()

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
      }

      img.onerror = () => {
        // Fallback on error - circular icon
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.fillStyle = '#3B82F6'
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 3
        ctx.stroke()

        // Film icon fallback
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 20px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎬', size / 2, size / 2)

        resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
      }

      // Use the full poster URL from the data
      img.src = posterPath
    })
  }

  /**
   * Show all locations for a movie
   */
  const showAllLocations = (feature: GeoJSONFeature) => {
    if (!map.current) return

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
          'line-color': '#F59E0B', // Vibrant amber color
          'line-width': 4,
          'line-opacity': 0.9,
          'line-blur': 1
        }
      })

      // Keep line visible permanently
    }
  }

  /**
   * Add movie markers from GeoJSON - INITIAL LOAD ONLY
   */
  useEffect(() => {
    if (!map.current || geojsonFeatures.length === 0) return

    // Only run this effect once when data is first loaded
    if (map.current.getSource('movies')) return

    async function initializeMarkers() {
      if (!map.current) return

      // Load ALL posters BEFORE adding map layer (prevents warnings)
      const BATCH_SIZE = 20
      let loadedCount = 0
      const allFeatures = geojsonFeatures

      // Always show loading on initial setup
      setLoadingState({
        isLoading: true,
        progress: 90,
        stage: `Loading posters... 0/${allFeatures.length}`
      })

      // Load posters in batches and await completion
      for (let i = 0; i < allFeatures.length; i += BATCH_SIZE) {
        const batch = allFeatures.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (feature) => {
            const movieId = feature.properties.movie_id
            const posterPath = feature.properties.poster
            const isMultiLocation = feature.properties.locations_count > 1
            const iconName = `poster-${movieId}`

            if (!map.current!.hasImage(iconName)) {
              try {
                const posterIcon = await createPosterIcon(posterPath, movieId, isMultiLocation)
                map.current!.addImage(iconName, posterIcon)
                loadedImagesRef.current.add(iconName) // Mark as loaded
                loadedCount++
              } catch (error) {
                console.error(`Failed to add poster icon for ${movieId}:`, error)
                // Add fallback icon on error
                const fallbackIcon = await createPosterIcon(null, movieId, isMultiLocation)
                map.current!.addImage(iconName, fallbackIcon)
                loadedImagesRef.current.add(iconName) // Mark as loaded
                loadedCount++
              }
            } else {
              loadedCount++
            }
          })
        )

        // Update progress after each batch
        const progress = Math.round((loadedCount / allFeatures.length) * 100)
        setLoadingState({
          isLoading: true,
          progress: 90 + (progress * 0.09), // 90-99% range
          stage: `Loading posters... ${loadedCount}/${allFeatures.length}`
        })
      }

      // Show rendering stage
      setLoadingState({
        isLoading: true,
        progress: 99,
        stage: 'Rendering markers...'
      })

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

      // Create GeoJSON for display
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: displayFeatures as any
      }

      // Add source - DISABLE clustering so markers stay visible
      map.current!.addSource('movies', {
        type: 'geojson',
        data: geojson,
        // Clustering disabled - we want to see all markers
        cluster: false,
      })

      // Add all movie markers layer (now each marker represents one actual location)
      map.current!.addLayer({
        id: 'movie-markers',
        type: 'symbol',
        source: 'movies',
        layout: {
          'icon-image': ['concat', 'poster-', ['get', 'movie_id']],
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'text-field': ['get', 'title'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 14,
          'text-offset': [0, 2.8],
          'text-anchor': 'top',
          'text-max-width': 12,
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#10be50ff',
          'text-halo-color': '#1F2937',
          'text-halo-width': 2.5,
          'text-halo-blur': 1
        }
      })

      // All done - hide loading screen
      setTimeout(() => {
        setLoadingState({ isLoading: false, progress: 100, stage: 'Complete' })
      }, 300) // Small delay for smooth transition

      // Add unified click handler for all movie markers
      const handleMarkerClick = (e: any) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]

        // Try to find in geojsonFeatures by movie_id
        const featureByMovieId = geojsonFeatures.find(f => f.properties.movie_id === feature.properties.movie_id)

        if (featureByMovieId) {
          const movieFromFeature = convertFeatureToMovie(featureByMovieId)
          onMovieSelect(movieFromFeature)
          // Show all locations for multi-location movies
          if (featureByMovieId.properties.locations_count > 1) {
            setTimeout(() => showAllLocations(featureByMovieId), 500)
          }
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

      // Change cursor on hover
      map.current!.on('mouseenter', 'movie-markers', () => {
        map.current!.getCanvas().style.cursor = 'pointer'
      })
      map.current!.on('mouseleave', 'movie-markers', () => {
        map.current!.getCanvas().style.cursor = ''
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
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Loading Screen Overlay */}
      {loadingState.isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
          <div className="text-center space-y-6 px-8">
            {/* Movie emoji animation */}
            <div className="text-7xl animate-bounce">
              🎬
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-white">
              CineMap
            </h2>

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

      {/* Movie count badge */}
      <div className="absolute top-20 left-4 z-10 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎬</span>
          <div>
            <p className="text-xs text-gray-300">Total Movies</p>
            <p className="text-xl font-bold">
              {movies.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

Map.displayName = 'Map'

export default Map
