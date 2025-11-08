'use client'

/**
 * MoviePage Component - Full page view for a movie with locations
 * Client component for interactivity
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Movie } from '../lib/types'
import { formatRating, getYouTubeEmbedUrl } from '../src/utils/helpers'
import dynamic from 'next/dynamic'

// Dynamically import Map (client-only)
const MapPreview = dynamic(() => import('./MapPreview'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-900 rounded-lg flex items-center justify-center">
      <p className="text-white">Loading map...</p>
    </div>
  ),
})

interface MoviePageProps {
  movie: Movie
  slug: string
  relatedMovies?: Movie[]
}

export default function MoviePage({ movie, slug: _slug, relatedMovies = [] }: MoviePageProps) {
  const router = useRouter()
  const [selectedLocation, setSelectedLocation] = useState<number>(0)
  const [slugMap, setSlugMap] = useState<Record<string, string>>({})

  // Load slug mapping on client side
  useEffect(() => {
    fetch('/data/movies_slugs_reverse.json')
      .then(res => res.json())
      .then(data => setSlugMap(data))
      .catch(err => console.error('Failed to load slug mapping:', err))
  }, [])

  const embedUrl = getYouTubeEmbedUrl(movie.trailer)

  const handleBack = () => {
    router.push('/')
  }

  const handleRelatedMovieClick = (relatedSlug: string) => {
    router.push(`/movie/${relatedSlug}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Back to Map Button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-xl border border-white/10"
          aria-label="Back to map"
        >
          <span>←</span>
          <span>Back to Map</span>
        </button>
      </div>

      {/* Banner Hero Image */}
      {(movie as any).banner_1280 && (
        <div className="w-full h-96 overflow-hidden relative mb-8">
          <img
            src={(movie as any).banner_1280}
            alt={`${movie.title} backdrop`}
            className="w-full h-full object-cover"
            loading="eager"
          />
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-900" />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="relative mb-12">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster */}
            {movie.poster && (
              <div className="flex-shrink-0">
                <img
                  src={movie.poster}
                  alt={`${movie.title} poster`}
                  className="w-64 rounded-lg shadow-2xl"
                  loading="eager"
                />
              </div>
            )}

            {/* Movie Info */}
            <div className="flex-1">
              <h1 className="text-5xl font-bold text-white mb-4">
                {movie.title}
              </h1>

              <div className="flex items-center gap-4 text-white/90 mb-6 flex-wrap">
                <span className="text-2xl font-semibold">{movie.year}</span>

                {movie.imdb_rating && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-lg">
                    <span className="text-yellow-400 text-xl">⭐</span>
                    <span className="font-bold text-xl">{formatRating(movie.imdb_rating)}</span>
                    <span className="text-sm">/10</span>
                  </div>
                )}

                <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/20 rounded-lg">
                  <span className="text-xl">📍</span>
                  <span className="font-semibold">{movie.locations.length} location{movie.locations.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Genres */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {movie.genres.slice(0, 5).map((genre) => (
                  <span
                    key={genre}
                    className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white font-medium"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              {/* External Links */}
              <div className="flex gap-3">
                {movie.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-bold transition-colors"
                  >
                    View on IMDb
                  </a>
                )}
                {movie.tmdb_id && (
                  <a
                    href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors"
                  >
                    View on TMDB
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trailer */}
        {embedUrl && (
          <div className="mb-12 bg-black/30 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-3xl font-bold text-white mb-4">
              🎬 Trailer
            </h2>
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

        {/* Map Preview with Locations */}
        <div className="mb-12 bg-black/30 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-3xl font-bold text-white mb-4">
            📍 Filming Locations on Map
          </h2>
          <MapPreview
            movie={movie}
            selectedLocationIndex={selectedLocation}
          />
        </div>

        {/* Filming Locations List */}
        <div className="mb-12 bg-black/30 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-3xl font-bold text-white mb-6">
            📍 Filming Locations ({movie.locations.length})
          </h2>
          <div className="grid gap-4">
            {movie.locations.map((location, index) => (
              <button
                key={index}
                onClick={() => setSelectedLocation(index)}
                className={`p-6 rounded-lg hover:bg-white/10 transition-colors text-left ${
                  selectedLocation === index ? 'bg-primary-500/30 border-2 border-primary-500' : 'bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-xl mb-2">
                      📍 {location.city}, {location.country}
                    </h3>
                    {location.description && (
                      <p className="text-gray-300 mb-2">
                        {location.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-400">
                      {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Where to Watch */}
        {movie.streaming && movie.streaming.length > 0 && (
          <div className="mb-12 bg-black/30 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-3xl font-bold text-white mb-4">
              📺 Where to Watch
            </h2>
            <div className="flex flex-wrap gap-3">
              {movie.streaming.map((platform) => (
                <span
                  key={platform}
                  className="px-6 py-3 bg-primary-500/20 text-primary-300 rounded-lg font-semibold text-lg"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Movies */}
        {relatedMovies.length > 0 && (
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-3xl font-bold text-white mb-6">
              🎬 Related Movies
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {relatedMovies.map((related) => {
                // Get slug for related movie from slug mapping
                const relatedSlug = slugMap[related.movie_id]
                if (!relatedSlug) return null // Skip if slug not loaded yet

                return (
                  <button
                    key={related.movie_id}
                    onClick={() => handleRelatedMovieClick(relatedSlug)}
                    className="group"
                  >
                    {related.poster && (
                      <img
                        src={related.poster}
                        alt={`${related.title} poster`}
                        className="w-full rounded-lg shadow-lg group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    )}
                    <p className="mt-2 text-sm text-white font-medium line-clamp-2">
                      {related.title}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
