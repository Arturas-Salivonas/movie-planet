/**
 * MovieModal Component - Detailed movie information modal
 */

import { useEffect } from 'react'
import type { Movie } from '../types'
import { formatRating, getYouTubeEmbedUrl } from '../utils/helpers'

interface MovieModalProps {
  movie: Movie
  onClose: () => void
  onShowAllLocations?: () => void
  onViewLocation?: (location: { lat: number; lng: number }) => void
  relatedMovies?: Movie[]
  onRelatedMovieClick?: (movie: Movie) => void
}

export default function MovieModal({
  movie,
  onClose,
  onShowAllLocations,
  onViewLocation,
  relatedMovies = [],
  onRelatedMovieClick
}: MovieModalProps) {
  /**
   * Handle ESC key to close modal
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  /**
   * Prevent body scroll when modal is open
   */
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  const embedUrl = getYouTubeEmbedUrl(movie.trailer)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-modal-title"
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
          aria-label="Close modal"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        {/* Header with Poster */}
        <div className="relative h-64 bg-gradient-to-br from-primary-600 to-purple-700">
          {movie.poster && (
            <img
              src={movie.poster}
              alt={`${movie.title} poster`}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 left-6 right-6">
            <h2
              id="movie-modal-title"
              className="text-4xl font-bold text-white mb-2"
            >
              {movie.title}
            </h2>
            <div className="flex items-center gap-4 text-white/90">
              <span className="text-lg">{movie.year}</span>
              {movie.imdb_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">⭐</span>
                  <span className="font-semibold">{formatRating(movie.imdb_rating)}</span>
                </div>
              )}
              <div className="flex gap-2">
                {movie.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Trailer */}
          {embedUrl && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Trailer
              </h3>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  title={`${movie.title} trailer`}
                  className="absolute inset-0 w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            </div>
          )}

          {/* Filming Locations */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Filming Locations ({movie.locations.length})
              </h3>
              {movie.locations.length > 1 && onShowAllLocations && (
                <button
                  onClick={onShowAllLocations}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 justify-center sm:justify-start"
                >

                  <span>Show All on Map</span>
                </button>
              )}
            </div>
            <div className="grid gap-3">
              {movie.locations.map((location, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        📍 {location.city}, {location.country}
                      </h4>
                      {location.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {location.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (onViewLocation) {
                          onViewLocation({ lat: location.lat, lng: location.lng })
                          onClose() // Close modal after flying to location
                        }
                      }}
                      className="px-3 py-1 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors"
                      aria-label={`View ${location.city} on map`}
                    >
                      View on Map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trivia */}
          {movie.trivia && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                🎬 Behind the Scenes
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {movie.trivia}
              </p>
            </div>
          )}

          {/* Where to Watch */}
          {movie.streaming && movie.streaming.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                📺 Where to Watch
              </h3>
              <div className="flex flex-wrap gap-2">
                {movie.streaming.map((platform) => (
                  <span
                    key={platform}
                    className="px-4 py-2 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-lg font-medium"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External Links */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {movie.imdb_id && (
              <a
                href={`https://www.imdb.com/title/${movie.imdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
              >
                View on IMDb
              </a>
            )}
            {movie.tmdb_id && (
              <a
                href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
              >
                View on TMDB
              </a>
            )}
          </div>

          {/* Related Movies */}
          {relatedMovies.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                🎬 Related Movies
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {relatedMovies.map((related) => (
                  <button
                    key={related.movie_id}
                    onClick={() => onRelatedMovieClick?.(related)}
                    className="group relative"
                    title={related.title}
                  >
                    {related.poster && (
                      <img
                        src={related.poster}
                        alt={`${related.title} poster`}
                        className="w-full rounded-lg shadow-lg group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    )}
                    <p className="mt-2 text-xs text-gray-700 dark:text-gray-300 font-medium line-clamp-2">
                      {related.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
