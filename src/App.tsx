import { useState, useRef } from 'react'
import Map, { MapRef } from './components/Map'
import SearchBar from './components/SearchBar'
import Filters from './components/Filters'
import MovieModal from './components/MovieModal'
import { Movie } from './types'

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
        <SearchBar
          onSearch={setSearchQuery}
          onMovieSelect={setSelectedMovie}
        />
      </div>

      {/* Filters Panel - Top Right */}
      <div className="absolute top-4 right-4 z-10 w-80">
        <Filters
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Main Map */}
      <Map
        ref={mapRef}
        selectedMovie={selectedMovie}
        onMovieSelect={setSelectedMovie}
        searchQuery={searchQuery}
        filters={filters}
        focusedMovieId={focusedMovieId}
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
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onShowAllLocations={handleShowAllLocations}
          onViewLocation={handleViewLocation}
        />
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
