'use client'

/**
 * Map Component - MapLibre GL JS map with globe projection and multi-location support
 * Refactored for better modularity and maintainability
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Movie, FilterState } from '../../types'
import { useMapInitialization } from '../../hooks/useMapInitialization'
import { useMapMarkers } from '../../hooks/useMapMarkers'

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
  getMapInstance: () => maplibregl.Map | null
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

  // Initialize map with globe projection
  const { map } = useMapInitialization({ mapContainer })

  // Manage markers, loading, and interactions
  const { movies, geojsonFeatures, loadingState, initializedRef } = useMapMarkers({
    map,
    onMovieSelect,
    filters,
    focusedMovieId,
    onClearFocus
  })

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    showAllLocationsForMovie: (movie: Movie) => {
      if (!map.current) return

      const feature = geojsonFeatures.find(f => f.properties.movie_id === movie.movie_id)
      if (!feature) return

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

      // Hide clickable regions when focused on a movie
      if (map.current.getLayer('region-circles')) {
        map.current.setLayoutProperty('region-circles', 'visibility', 'none')
      }
    },
    flyToLocation: (lat: number, lng: number) => {
      if (!map.current) return

      const targetZoom = 12

      // Temporarily switch to mercator projection for accurate positioning
      ;(map.current as any).setProjection({ type: 'mercator' })

      // Use flyTo for smooth animation in mercator
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

        // Re-apply center and zoom after globe switch
        map.current.easeTo({
          center: [lng, lat],
          zoom: targetZoom,
          duration: 600,
          essential: true
        })
      }, 1300)
    },
    resetView: () => {
      if (!map.current) return

      // Remove connecting line if exists
      if (map.current.getLayer('connecting-line')) {
        map.current.removeLayer('connecting-line')
      }
      if (map.current.getSource('connecting-line')) {
        map.current.removeSource('connecting-line')
      }

      // Show clickable regions again
      if (map.current.getLayer('region-circles')) {
        map.current.setLayoutProperty('region-circles', 'visibility', 'visible')
      }

      map.current.flyTo({
        center: [0.35, 43],
        zoom: 3,
        duration: 1500,
        essential: true
      })
    },
    getMapInstance: () => {
      return map.current
    }
  }), [map, geojsonFeatures])

  /**
   * Handle selected movie - fit bounds to show all locations
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
  }, [map, selectedMovie])

  return (
    <div className="map-container">
      {/* Stars background */}
      <div className="stars-background" />

      {/* Map container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />

      {/* Loading Screen Overlay */}
      {loadingState.isLoading && !initializedRef.current && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
          <div className="text-center space-y-6 px-8">
            <div className="text-xl animate-bounce">
              <img src="images/logo/filmingmap-logo.webp" alt="filmingmap Logo" className="" />
            </div>

            <p className="text-xl text-gray-300">
              {loadingState.stage}
            </p>

            <div className="w-80 bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-purple-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>

            <p className="text-sm text-gray-400 font-mono">
              {Math.round(loadingState.progress)}%
            </p>
          </div>
        </div>
      )}


      <div className="hidden lg:block absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 max-w-xs">
        {/* Logo at Top */}

          <img
            src="/images/logo/filmingmap-logo.webp"
            alt="filmingmap Logo"
            className="h-8"
          />

      </div>

      {/* Movie Statistics - Top Right (Hidden on Mobile) */}
      <div className="hidden lg:flex absolute top-36 right-4 z-10 gap-3">
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

            <div className="hidden lg:block absolute top-56 right-4 bg-black/70 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 max-w-xs">


   {/* Instructions - Left Side (Hidden on Mobile) */}
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <span>ℹ️</span> How to Use
        </h3>
        <ul className="text-xs text-gray-300 space-y-1 mb-3">
          <li>🔍 Search for movies or locations</li>
          <li>🗺️ Click markers to explore</li>
          <li>🌐 Rotate & zoom the globe</li>
          <li>🎬 Discover filming locations worldwide</li>
        </ul>
      </div>

    </div>
  )
})

Map.displayName = 'Map'

export default Map
