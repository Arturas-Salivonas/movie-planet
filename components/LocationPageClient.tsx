'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface LocationMovie {
  movie_id: string
  title: string
  year: number
  genres: string[]
  poster?: string
  banner_1280?: string
  thumbnail_52?: string
  imdb_rating?: number
  londonLocationCount: number
}

interface LocationPageClientProps {
  movies: LocationMovie[]
  location: {
    city: string
    country: string
    slug: string
    coordinates: { lat: number; lng: number }
  }
  stats: {
    totalMovies: number
    totalLocations: number
    genres: Record<string, number>
    decades: Record<string, number>
  }
}

export default function LocationPageClient({ movies, location, stats }: LocationPageClientProps) {
  const [sortBy, setSortBy] = useState<'rating' | 'year' | 'title'>('rating')
  const [selectedGenre, setSelectedGenre] = useState<string>('all')
  const [slugMap, setSlugMap] = useState<Record<string, string>>({})

  // Load slug mapping on client side
  useEffect(() => {
    fetch('/data/movies_slugs_reverse.json')
      .then(res => res.json())
      .then(data => setSlugMap(data))
      .catch(err => console.error('Failed to load slug mapping:', err))
  }, [])

  // Filter and sort movies
  let filteredMovies = [...movies]

  if (selectedGenre !== 'all') {
    filteredMovies = filteredMovies.filter(m => m.genres.includes(selectedGenre))
  }

  filteredMovies.sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.imdb_rating || 0) - (a.imdb_rating || 0)
      case 'year':
        return b.year - a.year
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  const topGenres = Object.entries(stats.genres)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white" data-location-page>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="relative container mx-auto px-4 py-16">
          {/* Back to Home */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Globe
          </Link>

          {/* Location Header */}
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-6xl">📍</span>
              <div>
                <h1 className="text-5xl md:text-7xl font-bold mb-2">
                  {location.city}
                </h1>
                <p className="text-2xl text-gray-300">{location.country}</p>
              </div>
            </div>

            <p className="text-xl text-gray-300 mt-6 leading-relaxed">
              Explore <strong className="text-white">{stats.totalMovies} movies and TV series</strong> filmed
              in {location.city}, featuring <strong className="text-white">{stats.totalLocations} unique filming locations</strong>.
              From iconic landmarks to hidden gems, discover where Hollywood met {location.city}.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-primary-400 mb-2">{stats.totalMovies}</div>
              <div className="text-sm text-gray-400">Movies & Series</div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-purple-400 mb-2">{stats.totalLocations}</div>
              <div className="text-sm text-gray-400">Filming Locations</div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="text-4xl font-bold text-blue-400 mb-2">{topGenres.length}</div>
              <div className="text-sm text-gray-400">Different Genres</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Grid */}
      <div className="container mx-auto px-4 py-12">
        {/* Filter Controls */}
        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sort By */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              >
                <option value="rating">Highest Rated</option>
                <option value="year">Newest First</option>
                <option value="title">A-Z</option>
              </select>
            </div>

            {/* Filter by Genre */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              >
                <option value="all">All Genres</option>
                {topGenres.map(([genre, count]) => (
                  <option key={genre} value={genre}>
                    {genre} ({count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-gray-400">
            Showing {filteredMovies.length} of {stats.totalMovies} movies
          </div>
        </div>

        {/* Movies Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filteredMovies.map((movie) => {
            // Get slug for movie, fallback to movie_id if not loaded yet
            const movieSlug = slugMap[movie.movie_id] || movie.movie_id

            return (
              <Link
                key={movie.movie_id}
                href={`/?movie=${movieSlug}`}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 border border-gray-700 hover:border-primary-500 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary-500/20">
                {/* Poster */}
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <span className="text-6xl">🎬</span>
                  </div>
                )}

                {/* Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform">
                    <h3 className="font-bold text-white text-sm line-clamp-2 mb-1">
                      {movie.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <span>{movie.year}</span>
                      {movie.imdb_rating && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-400">⭐ {movie.imdb_rating.toFixed(1)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating Badge */}
                {movie.imdb_rating && (
                  <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-yellow-400 flex items-center gap-1">
                    ⭐ {movie.imdb_rating.toFixed(1)}
                  </div>
                )}

                {/* Location Count Badge */}
                {movie.londonLocationCount > 1 && (
                  <div className="absolute top-2 left-2 bg-primary-600/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold">
                    {movie.londonLocationCount} locations
                  </div>
                )}
              </div>

              {/* Title Below (Mobile) */}
              <div className="mt-2 md:hidden">
                <h3 className="font-semibold text-sm text-white line-clamp-2">{movie.title}</h3>
                <p className="text-xs text-gray-400">{movie.year}</p>
              </div>
            </Link>
          )
          })}
        </div>

        {/* Empty State */}
        {filteredMovies.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-2xl font-bold mb-2">No movies found</h3>
            <p className="text-gray-400">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-primary-600 to-purple-700 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Explore More Filming Locations
          </h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            Discover thousands of movies and their filming locations on our interactive 3D globe
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-all transform hover:scale-105"
          >
            <span>🌍</span>
            <span>Back to Interactive Globe</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
