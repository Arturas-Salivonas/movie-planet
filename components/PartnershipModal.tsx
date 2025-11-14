'use client'

import { useEffect, useState } from 'react'

interface PartnershipModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SiteStats {
  totalMovies: number
  moviesWithLocations: number
  totalLocations: number
  uniqueCountries: number
  lastUpdated: string
}

export default function PartnershipModal({ isOpen, onClose }: PartnershipModalProps) {
  const [stats, setStats] = useState<SiteStats | null>(null)

  // Load stats on mount
  useEffect(() => {
    fetch('/data/site-stats.json')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Failed to load site stats:', err))
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-primary-500 to-primary-600">
              <span className="text-3xl">🤝</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Partner with FilmingMap.com
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Join us in connecting film enthusiasts with the world's most iconic filming locations
            </p>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-3 md:grid-cols-3 gap-4 mb-12 p-6 bg-black/30 rounded-xl border border-gray-700">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-400 mb-1">
                {stats ? `${stats.moviesWithLocations.toLocaleString()}+` : '2,607+'}
              </div>
              <div className="text-sm text-gray-400">Movies & TV Series</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent-400 mb-1">
                {stats ? `${stats.totalLocations.toLocaleString()}+` : '8,164+'}
              </div>
              <div className="text-sm text-gray-400">Filming Locations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-1">TBC</div>
              <div className="text-sm text-gray-400">Monthly Visitors</div>
            </div>

          </div>

          {/* Partnership Opportunities */}
          <div className="space-y-6 mb-10">
            <h3 className="text-2xl font-bold text-white mb-6">Partnership Opportunities</h3>

            {/* Streaming Services */}
            <div className="p-6 bg-black/20 rounded-xl border border-gray-700 hover:border-primary-500 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🎬</div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-white mb-2">Streaming Services</h4>
                  <p className="text-gray-300 mb-3">
                    Feature your platform's content with "Watch Now" buttons on movie pages, genre-based promotions, and highlighted placement.
                  </p>
                  <div className="text-primary-400 font-semibold">Contact to discuss</div>
                </div>
              </div>
            </div>

            {/* Tourism Boards */}
            <div className="p-6 bg-black/20 rounded-xl border border-gray-700 hover:border-primary-500 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🏨</div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-white mb-2">Tourism Boards & Hotels</h4>
                  <p className="text-gray-300 mb-3">
                    Promote destinations through movies filmed in your region. Featured "Visit this location" CTAs and sponsored location guides.
                  </p>
                  <div className="text-primary-400 font-semibold">Contact to discuss</div>
                </div>
              </div>
            </div>

            {/* Production Companies */}
            <div className="p-6 bg-black/20 rounded-xl border border-gray-700 hover:border-primary-500 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🎥</div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-white mb-2">Production Companies</h4>
                  <p className="text-gray-300 mb-3">
                    Promote new releases with featured homepage placement, exclusive behind-the-scenes content, and location spotlights.
                  </p>
                  <div className="text-primary-400 font-semibold">Contact to discuss</div>
                </div>
              </div>
            </div>

            {/* Banner Advertising */}
            <div className="p-6 bg-black/20 rounded-xl border border-gray-700 hover:border-accent-500 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-4xl">📺</div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-white mb-2">Banner Advertising</h4>
                  <p className="text-gray-300 mb-3">
                    Premium placement above the fold with geo-targeted campaigns focused on movie and travel industry audiences.
                  </p>
                  <div className="text-accent-400 font-semibold">Contact to discuss</div>
                </div>
              </div>
            </div>

            {/* Affiliate Programs */}
            <div className="p-6 bg-black/20 rounded-xl border border-gray-700 hover:border-accent-500 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🛒</div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-white mb-2">Affiliate Programs</h4>
                  <p className="text-gray-300 mb-3">
                    Partner for movie tickets, travel bookings, merchandise, and more. Commission-based revenue sharing model.
                  </p>
                  <div className="text-accent-400 font-semibold">Contact to discuss</div>
                </div>
              </div>
            </div>
          </div>

          {/* Why Partner Section */}
          <div className="mb-10 p-6 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-xl border border-primary-500/20">
            <h3 className="text-xl font-bold text-white mb-4">Why Partner with FilmingMap.com?</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">✓</span>
                <span><strong>Highly Engaged Audience:</strong> Film enthusiasts and travel planners with 5+ min average session time</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">✓</span>
                <span><strong>Unique Platform:</strong> The only comprehensive 3D interactive movie location map in the world</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">✓</span>
                <span><strong>Perfect Audience Fit:</strong> Intersection of entertainment and travel - premium demographics</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">✓</span>
                <span><strong>Growing Fast:</strong> Exponential traffic growth with 2,607 movies and expanding daily</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary-400 mt-1">✓</span>
                <span><strong>SEO Authority:</strong> Ranking for thousands of movie and location-based keywords</span>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div className="text-center p-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl">
            <h3 className="text-2xl font-bold text-white mb-4">Let's Talk</h3>
            <p className="text-white/90 mb-6 max-w-xl mx-auto">
              Ready to explore partnership opportunities? Get in touch to discuss how we can work together.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="mailto:ecobra@gmail.com?subject=FilmingMap Partnership Inquiry"
                className="px-8 py-4 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                ecobra@gmail.com
              </a>

            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>All partnerships are subject to review and mutual agreement</p>
          </div>
        </div>
      </div>
    </div>
  )
}
