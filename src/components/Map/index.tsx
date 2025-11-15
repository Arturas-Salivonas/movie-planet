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
import { STYLES } from '../../../lib/constants/theme'

interface MapProps {
  selectedMovie: Movie | null
  onMovieSelect: (movie: Movie | null) => void
  searchQuery: string
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
  convertGeoJSONToMovie?: (feature: any) => Promise<Movie>
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
  convertGeoJSONToMovie,
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)

  // Initialize map with globe projection
  const { map } = useMapInitialization({ mapContainer })

  // Manage markers, loading, and interactions
  const { geojsonFeatures, loadingState, initializedRef } = useMapMarkers({
    map,
    onMovieSelect,
    filters,
    focusedMovieId,
    onClearFocus,
    convertGeoJSONToMovie
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
      <div
        ref={mapContainer}
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
        onDragStart={(e) => e.preventDefault()}
        className="select-none"
      />

      {/* Loading Screen Overlay */}
      {loadingState.isLoading && !initializedRef.current && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={STYLES.spaceBackground}>
          <div className="text-center space-y-6 px-8">
            {/* <div className="text-xl animate-bounce">
              <img src="images/logo/filmingmap-logo.webp" alt="filmingmap Logo" className="" />
            </div> */}

            <p className="text-xl text-gray-300">
              {loadingState.stage}
            </p>

            <div className="w-80 bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-accent-300 h-full transition-all duration-300 ease-out"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>

            <p className="text-sm text-gray-400 font-mono">
              {Math.round(loadingState.progress)}%
            </p>
          </div>
        </div>
      )}


      {/* <div className="hidden lg:block absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 max-w-xs">


          <img
            src="/images/logo/filmingmap-logo.webp"
            alt="filmingmap Logo"
            className="h-8"
          />

      </div> */}

      {/* Movie Statistics - Top Right (Hidden on Mobile) */}
      {/* <div className="hidden lg:flex absolute top-36 right-4 z-10 gap-3">
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
      </div> */}

            <div className="select-none hidden mt-4 lg:block z-10 absolute top-0 left-4 bg-black/70 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 max-w-xs">


   {/* Instructions - Left Side (Hidden on Mobile) */}
    <p className='inline-flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-accent-100 dark:bg-accent-900/40 text-accent-800 dark:text-accent-300 text-[10px] lg:text-xs hover:bg-accent-200 dark:hover:bg-accent-900/60 transition-colors font-semibold border lg:border-2 border-accent-400 dark:border-accent-600 shadow-md lg:shadow-lg shadow-accent-200/50 dark:shadow-accent-500/20'>Alpha v0.17</p>
   <p className='text-xs text-gray-300 mt-2'>Interactive globe that lets you discover filming locations from over <span className='font-bold italic'>2647+</span> movie &  TV shows.
</p>
{/* <p className='text-xs text-gray-300 space-y-1 mt-3'>  Use the 🔍 search or filters to find your favorites, 🗺️ click on markers to learn more about each location, and 🌐 rotate or zoom the globe to explore cinematic landscapes around the world.</p> */}
        <h3 className="text-sm font-bold mb-2 mt-2 flex items-center gap-2">
         How to Use:
        </h3>
        <ul className="text-xs text-gray-300 space-y-1 mb-3">
          <li>🔍 Use the search or filters to find your favorites</li>
          <li>🗺️ Click on markers to learn more about movie</li>
          <li>🌐 Rotate or zoom the globe to explore locations</li>

        </ul>

             {/* <p className="text-xl font-bold">
               movies {movies.filter(m => m.type !== 'tv').length}
              </p>
           <p className="text-xl font-bold">
               tv shows {movies.filter(m => m.type === 'tv').length}
              </p> */}
      </div>

    </div>
  )
})

Map.displayName = 'Map'

export default Map
