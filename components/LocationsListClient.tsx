'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { LocationData } from '../lib/locations'

interface LocationsListClientProps {
  locations: LocationData[]
}

export default function LocationsListClient({ locations }: LocationsListClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')

  // Get unique countries
  const countries = useMemo(() => {
    const uniqueCountries = Array.from(new Set(locations.map(l => l.country))).sort()
    return uniqueCountries
  }, [locations])

  // Filter locations
  const filteredLocations = useMemo(() => {
    return locations.filter(location => {
      const matchesSearch = searchQuery === '' ||
        location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.country.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCountry = selectedCountry === 'all' || location.country === selectedCountry

      return matchesSearch && matchesCountry
    })
  }, [locations, searchQuery, selectedCountry])

  // Group by country
  const groupedLocations = useMemo(() => {
    const grouped: Record<string, LocationData[]> = {}

    filteredLocations.forEach(location => {
      if (!grouped[location.country]) {
        grouped[location.country] = []
      }
      grouped[location.country].push(location)
    })

    return grouped
  }, [filteredLocations])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Map
          </Link>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            🎬 Filming Locations
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Discover where your favorite movies and TV shows were filmed. Explore our comprehensive database of {locations.length} filming locations from around the world.
          </p>
        </div>
      </header>

      {/* Search and Filter Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Country Filter */}
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[200px]"
          >
            <option value="all" className="bg-gray-900">All Countries ({locations.length})</option>
            {countries.map(country => {
              const count = locations.filter(l => l.country === country).length
              return (
                <option key={country} value={country} className="bg-gray-900">
                  {country} ({count})
                </option>
              )
            })}
          </select>
        </div>

        {/* Results Count */}
        <div className="text-gray-300 mb-6">
          Showing {filteredLocations.length} of {locations.length} locations
        </div>

        {/* Locations Grid - Grouped by Country */}
        <div className="space-y-12">
          {Object.keys(groupedLocations).sort().map(country => (
            <div key={country}>
              {/* Country Header */}
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">

                {country}
                <span className="text-sm font-normal text-gray-400">
                  ({groupedLocations[country].length} location{groupedLocations[country].length !== 1 ? 's' : ''})
                </span>
              </h2>

              {/* Locations Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedLocations[country].map(location => (
                  <Link
                    key={location.slug}
                    href={`/location/${location.slug}`}
                    className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 hover:bg-white/20 hover:border-purple-400 transition-all hover:scale-105 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {location.city}
                      </h3>
                      <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-purple-300 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">
                      {location.country}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredLocations.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-white mb-2">No locations found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
