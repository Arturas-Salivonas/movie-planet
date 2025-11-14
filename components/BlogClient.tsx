'use client'

import Link from 'next/link'
import { STYLES } from '../lib/constants/theme'

export default function BlogClient() {
  return (
    <>
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>

      <div className="min-h-screen pt-20" style={STYLES.spaceBackground}>
        {/* Header */}
        <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Map
            </Link>

            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              📝 Blog
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl">
              Behind-the-scenes stories, filming location guides, and movie tourism insights
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto text-center">
            {/* Coming Soon Animation */}
            <div className="mb-12">
              <div className="relative inline-block">
                <div className="text-9xl mb-8 animate-bounce">
                  🎬
                </div>
                <div className="absolute -top-4 -right-4 text-4xl animate-spin-slow">
                  ✨
                </div>
                <div className="absolute -bottom-4 -left-4 text-4xl animate-spin-slow">
                  ✨
                </div>
              </div>
            </div>

            <h2 className="text-5xl sm:text-6xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-accent-400 to-primary-500">
              Coming Soon
            </h2>

            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              We're working on amazing content about filming locations, movie tourism,
              behind-the-scenes stories, and guides to visiting your favorite movie destinations.
            </p>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-12 text-left">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 hover:bg-white/15 transition-all">
                <div className="text-4xl mb-4">🗺️</div>
                <h3 className="text-xl font-semibold text-white mb-2">Location Guides</h3>
                <p className="text-gray-300 text-sm">
                  Detailed guides to visiting iconic filming locations around the world
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 hover:bg-white/15 transition-all">
                <div className="text-4xl mb-4">🎥</div>
                <h3 className="text-xl font-semibold text-white mb-2">Behind the Scenes</h3>
                <p className="text-gray-300 text-sm">
                  Fascinating stories about how movies are made and where they're filmed
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 hover:bg-white/15 transition-all">
                <div className="text-4xl mb-4">✈️</div>
                <h3 className="text-xl font-semibold text-white mb-2">Travel Tips</h3>
                <p className="text-gray-300 text-sm">
                  Practical advice for planning your movie tourism adventures
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 backdrop-blur-sm border border-primary-400/30 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-4">
                Stay Tuned! 🎉
              </h3>
              <p className="text-gray-300 mb-6">
                In the meantime, explore our interactive 3D map to discover thousands of filming locations.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg font-semibold transition-all hover:scale-105 shadow-lg"
              >
                <span>🌍</span>
                <span>Explore the Map</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
