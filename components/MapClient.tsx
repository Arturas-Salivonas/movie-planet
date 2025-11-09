'use client'

/**
 * MapClient - Client wrapper for the map component
 * Refactored for better modularity and maintainability
 */

import { useState, lazy, Suspense, useEffect, useRef, forwardRef } from 'react'
import type { Movie, FilterState } from '../lib/types'
import type { MapRef } from '../src/components/Map'
import { useMovieNavigation } from '../src/hooks/useMovieNavigation'
import { useRelatedMovies } from '../src/hooks/useRelatedMovies'

// Lazy load components
const SearchBar = lazy(() => import('../src/components/SearchBar'))
const Filters = lazy(() => import('../src/components/Filters'))
const MovieModal = lazy(() => import('../src/components/MovieModal'))
const PartnershipModal = lazy(() => import('./PartnershipModal'))

interface MapProps {
  selectedMovie: Movie | null
  onMovieSelect: (movie: Movie | null) => void
  searchQuery: string
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
}

// Dynamically import MapWrapper with proper ref forwarding
const Map = forwardRef<MapRef, MapProps>((props, ref) => {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import('../src/components/MapWrapper').then(mod => setMapComponent(() => mod.default))
  }, [])

  if (!MapComponent) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-center space-y-6 px-8">
          <div className="text-7xl animate-bounce">🎬</div>
          <h2 className="text-3xl font-bold text-white">FilmingMap</h2>
          <p className="text-xl text-gray-300">Loading globe...</p>
        </div>
      </div>
    )
  }

  return <MapComponent {...props} ref={ref} />
})

Map.displayName = 'Map'

interface MapClientProps {
  initialMovieSlug?: string
  initialMovie?: Movie
  initialRelatedMovies?: Movie[]
}

export default function MapClient({
  initialMovieSlug: _initialMovieSlug,
  initialMovie,
  initialRelatedMovies = []
}: MapClientProps) {
  const mapRef = useRef<MapRef>(null)
  const [focusedMovieId, setFocusedMovieId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLocationViewed, setIsLocationViewed] = useState<boolean>(false)
  const [isPartnershipModalOpen, setIsPartnershipModalOpen] = useState<boolean>(false)
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    decades: [1980, 2030],
    streaming: [],
  })

  // Movie navigation hook
  const { selectedMovie, handleMovieSelect, closeModal } = useMovieNavigation({
    initialMovie
  })

  // Related movies hook
  const { relatedMovies, fetchRelatedMovies, clearRelatedMovies } = useRelatedMovies()

  // Initialize related movies if provided
  useEffect(() => {
    if (initialRelatedMovies.length > 0 && relatedMovies.length === 0) {
      // Don't overwrite if already loaded
      clearRelatedMovies()
    }
  }, [initialRelatedMovies, relatedMovies.length, clearRelatedMovies])

  // Fetch related movies when a movie is selected
  useEffect(() => {
    if (selectedMovie) {
      fetchRelatedMovies(selectedMovie)
    } else {
      clearRelatedMovies()
    }
  }, [selectedMovie, fetchRelatedMovies, clearRelatedMovies])

  // Listen for partnership modal open event from Map component
  useEffect(() => {
    const handleOpenPartnership = () => {
      setIsPartnershipModalOpen(true)
    }
    window.addEventListener('openPartnershipModal', handleOpenPartnership)
    return () => window.removeEventListener('openPartnershipModal', handleOpenPartnership)
  }, [])

  const handleResetFocus = () => {
    setFocusedMovieId(null)

    // Show clickable regions again when clearing focus
    if (mapRef.current) {
      const mapInstance = mapRef.current.getMapInstance()
      if (mapInstance && mapInstance.getLayer('region-circles')) {
        mapInstance.setLayoutProperty('region-circles', 'visibility', 'visible')
      }
    }
  }

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.resetView()
      setIsLocationViewed(false)
      setFocusedMovieId(null)
    }
  }

  const handleShowAllLocations = () => {
    if (selectedMovie && mapRef.current) {
      mapRef.current.showAllLocationsForMovie(selectedMovie)
      setFocusedMovieId(selectedMovie.movie_id)
      closeModal()
      setIsLocationViewed(true)
    }
  }

  const handleViewLocation = (location: any) => {
    if (mapRef.current && selectedMovie) {
      // Hide other markers by setting focused movie (same logic as "Show All on Map")
      setFocusedMovieId(selectedMovie.movie_id)

      // Fly to the specific location
      mapRef.current.flyToLocation(location.lat, location.lng)
      setIsLocationViewed(true)

      // Hide clickable regions when viewing a specific location
      const mapInstance = mapRef.current.getMapInstance()
      if (mapInstance && mapInstance.getLayer('region-circles')) {
        mapInstance.setLayoutProperty('region-circles', 'visibility', 'none')
      }
    }

    setTimeout(() => {
      closeModal()
    }, 100)
  }

  return (
    <div className="relative w-full h-full z-10">
      {/* Search Bar - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 w-11/12 sm:w-96 max-w-md">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <SearchBar
            onSearch={setSearchQuery}
            onMovieSelect={handleMovieSelect}
          />
        </Suspense>
      </div>

      {/* Filters Panel - Top Right (Hidden on Mobile) */}
      <div className="hidden lg:block absolute top-4 right-4 z-10 w-80">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="space-y-3">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        }>
          <Filters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </Suspense>
      </div>

      {/* Main Map */}
      <Map
        ref={mapRef}
        selectedMovie={selectedMovie}
        onMovieSelect={handleMovieSelect}
        searchQuery={searchQuery}
        filters={filters}
        focusedMovieId={focusedMovieId}
        onClearFocus={handleResetFocus}
      />

      {/* Movie Modal */}
      {selectedMovie && (
        <Suspense fallback={null}>
          <MovieModal
            movie={selectedMovie}
            relatedMovies={relatedMovies}
            onClose={closeModal}
            onRelatedMovieClick={handleMovieSelect}
            onShowAllLocations={handleShowAllLocations}
            onViewLocation={handleViewLocation}
          />
        </Suspense>
      )}

      {/* Reset Focus Button - Shows when a movie is focused */}
      {focusedMovieId && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          <button
            onClick={handleResetFocus}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>Show All Movies</span>
          </button>
        </div>
      )}

      {/* Reset View Button - Shows when user has viewed a location */}
      {isLocationViewed && !focusedMovieId && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          <button
            onClick={handleResetView}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg font-semibold shadow-xl backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>Reset View</span>
          </button>
        </div>
      )}

      {/* Footer - Attribution */}
      <div className="absolute bottom-4 left-4 z-10 text-xs text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-2 sm:px-3 py-1 rounded max-w-[calc(100vw-2rem)] sm:max-w-none">
        <span className="hidden sm:inline">Created with ❤️ by </span>
        <a href="https://github.com/Arturas-Salivonas" target="_blank" rel="noopener noreferrer" className="hover:underline">
          <span className="sm:hidden">AS</span>
          <span className="hidden sm:inline">Arturas Salivonas</span>
        </a>
      </div>

      {/* Partnership Modal */}
      <Suspense fallback={null}>
        <PartnershipModal
          isOpen={isPartnershipModalOpen}
          onClose={() => setIsPartnershipModalOpen(false)}
        />
      </Suspense>
    </div>
  )
}
