import { useState, useRef, lazy, Suspense } from 'react'
import Map, { MapRef } from './components/Map'
import { Movie } from './types'

// Lazy load heavy components
const SearchBar = lazy(() => import('./components/SearchBar'))
const Filters = lazy(() => import('./components/Filters'))
const MovieModal = lazy(() => import('./components/MovieModal'))

function App() {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [focusedMovieId, setFocusedMovieId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filters, setFilters] = useState({
    genres: [] as string[],
    decades: [1980, 2030] as [number, number],
    streaming: [] as string[],
  })
  const mapRef = useRef<MapRef>(null)

  const handleShowAllLocations = () => {
    if (selectedMovie && mapRef.current) {
      // Close modal and show only this movie's markers
      setFocusedMovieId(selectedMovie.movie_id)
      setSelectedMovie(null)
      mapRef.current.showAllLocationsForMovie(selectedMovie)
    }
  }

  const handleViewLocation = (location: { lat: number; lng: number }) => {
    if (mapRef.current) {
      mapRef.current.flyToLocation(location.lat, location.lng)
    }
  }

  const handleResetFocus = () => {
    setFocusedMovieId(null)
  }

  return (
    <div className="relative w-full h-full">
      {/* Search Bar - Top Left */}
      <div className="absolute top-4 left-4 z-10 w-96">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <SearchBar
            onSearch={setSearchQuery}
            onMovieSelect={setSelectedMovie}
          />
        </Suspense>
      </div>

      {/* Filters Panel - Top Right */}
      <div className="absolute top-4 right-4 z-10 w-80">
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
        onMovieSelect={setSelectedMovie}
        searchQuery={searchQuery}
        filters={filters}
        focusedMovieId={focusedMovieId}
        onClearFocus={handleResetFocus}
      />

      {/* Reset Focus Button - Shows when a movie is focused */}
      {focusedMovieId && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={handleResetFocus}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
          >
            <span>↩️</span>
            <span>Show All Movies</span>
          </button>
        </div>
      )}

      {/* Movie Detail Modal */}
      {selectedMovie && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl h-[600px] m-4 animate-pulse"></div>
          </div>
        }>
          <MovieModal
            movie={selectedMovie}
            onClose={() => setSelectedMovie(null)}
            onShowAllLocations={handleShowAllLocations}
            onViewLocation={handleViewLocation}
          />
        </Suspense>
      )}

      {/* Footer - Attribution */}
      <div className="absolute bottom-4 left-4 z-10 text-xs text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1 rounded">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © OpenStreetMap contributors
        </a>
        {' | '}
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © CARTO
        </a>
      </div>
    </div>
  )
}

export default App
