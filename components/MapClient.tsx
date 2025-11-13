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
import { useFilterPersistence } from '../src/hooks/useFilterPersistence'

// Lazy load components
const SearchBar = lazy(() => import('../src/components/SearchBarOptimized'))
const Filters = lazy(() => import('../src/components/Filters'))
const MovieModal = lazy(() => import('../src/components/MovieModal'))
const PartnershipModal = lazy(() => import('./PartnershipModal'))
const Navigation = lazy(() => import('./Navigation'))

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
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)

  // Use filter persistence hook (localStorage)
  const { filters, setFilters } = useFilterPersistence()

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

  // Handle removing individual filters
  const removeGenreFilter = (genre: string) => {
    setFilters({ ...filters, genres: filters.genres.filter(g => g !== genre) })
  }

  const removeStreamingFilter = (platform: string) => {
    setFilters({ ...filters, streaming: filters.streaming.filter(p => p !== platform) })
  }

  const removeStarRatingFilter = () => {
    setFilters({ ...filters, starRating: [0, 10] })
  }

  const removeTopIMDBFilter = () => {
    setFilters({ ...filters, topIMDB: false })
  }

  const clearAllFilters = () => {
    setFilters({
      genres: [],
      decades: [1980, 2030],
      streaming: [],
      starRating: [0, 10],
      topIMDB: false,
    })
  }

  // Check if any filters are active
  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.streaming.length > 0 ||
    filters.starRating[0] !== 0 ||
    filters.starRating[1] !== 10 ||
    filters.topIMDB

  return (
    <div className="relative w-full h-full z-10">
      {/* Navigation - Full Width on Mobile, Centered on Desktop */}
      <div className="absolute top-4 left-4 right-4 lg:left-1/2 lg:right-auto lg:transform lg:-translate-x-1/2 z-10 lg:w-auto">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-2">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <Navigation
            onPartnershipClick={() => setIsPartnershipModalOpen(true)}
            onSearchClick={() => setIsSearchOpen(!isSearchOpen)}
          />
        </Suspense>
      </div>

      {/* Search Bar & Filters Panel - Hidden on Mobile by Default, Always Visible on Desktop */}
      <div className={`absolute top-20 lg:top-4 right-4 z-20 w-[calc(100%-2rem)] sm:w-96 lg:w-80 space-y-3 transition-all duration-300 ${
        isSearchOpen ? 'block' : 'hidden lg:block'
      }`}>
        {/* Search Bar */}
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <SearchBar
            onSearch={setSearchQuery}
            onMovieSelect={(movie) => {
              handleMovieSelect(movie)
              setIsSearchOpen(false) // Close search on mobile after selection
            }}
          />
        </Suspense>

        {/* Filters Panel (Hidden on Mobile) */}
        <div className="hidden lg:block">
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
      </div>

      {/* Active Filters Display - Shows selected filters as removable chips */}
      {hasActiveFilters && (
        <div className="absolute top-36 lg:top-36 right-4 z-10 w-[calc(100%-2rem)] sm:w-96 lg:w-80">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Active Filters
              </span>
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Genre filters */}
              {filters.genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => removeGenreFilter(genre)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 text-xs rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
                  title="Click to remove"
                >
                  <span>{genre}</span>
                  <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              ))}

              {/* Streaming filters */}
              {filters.streaming.map((platform) => (
                <button
                  key={platform}
                  onClick={() => removeStreamingFilter(platform)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-xs rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                  title="Click to remove"
                >
                  <span>{platform}</span>
                  <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              ))}

              {/* Star rating filter */}
              {(filters.starRating[0] !== 0 || filters.starRating[1] !== 10) && (
                <button
                  onClick={removeStarRatingFilter}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-xs rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
                  title="Click to remove"
                >
                  <span>⭐ {filters.starRating[0].toFixed(1)}-{filters.starRating[1].toFixed(1)}</span>
                  <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}

              {/* TOP 250 IMDB filter */}
              {filters.topIMDB && (
                <button
                  onClick={removeTopIMDBFilter}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors font-semibold border-2 border-amber-400 dark:border-amber-600 animate-pulse-soft shadow-lg shadow-amber-200/50 dark:shadow-amber-500/20"
                  title="Click to remove"
                >
                  <span>🏆IMDB TOP 250</span>
                  <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="absolute top-24 lg:top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
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
        <div className="absolute top-24 lg:top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
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
