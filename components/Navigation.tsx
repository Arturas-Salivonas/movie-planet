'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavigationProps {
  onPartnershipClick: () => void
  onSearchClick?: () => void
}

export default function Navigation({ onPartnershipClick, onSearchClick }: NavigationProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <nav className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-3 lg:hidden">
        {/* Logo/Brand */}
        <Link href="/" className="text-lg font-bold text-gray-800 dark:text-white" onClick={closeMenu}>
                 <img
            src="/images/logo/filmingmap-logo.webp"
            alt="filmingmap Logo"
            className="h-8"
          />
        </Link>

        <div className="flex items-center gap-2">
          {/* Search Icon */}
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Search"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}

          {/* Hamburger Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col p-2 space-y-1">
            <Link
              href="/"
              onClick={closeMenu}
              className={`px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                isActive('/')
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-l-4 border-primary-600 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              🗺️ 3D Map
            </Link>
            <Link
              href="/blog"
              onClick={closeMenu}
              className={`px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                isActive('/blog')
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-l-4 border-primary-600 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              📝 Blog
            </Link>
            <Link
              href="/location"
              onClick={closeMenu}
              className={`px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                isActive('/location') && pathname === '/location'
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-l-4 border-primary-600 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              📍 Locations
            </Link>
            <button
              onClick={() => {
                onPartnershipClick()
                closeMenu()
              }}
              className="px-4 py-3 rounded-md text-base font-medium text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              🤝 Partnership
            </button>
          </div>
        </div>
      )}

      {/* Desktop Menu */}
      <div className="hidden lg:flex items-center justify-center gap-2 p-2">
        <Link
          href="/"
          className={`px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200 ${
            isActive('/')
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm ring-2 ring-primary-200 dark:ring-primary-800'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          3D Map
        </Link>
        <Link
          href="/blog"
          className={`px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200 ${
            isActive('/blog')
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm ring-2 ring-primary-200 dark:ring-primary-800'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Blog
        </Link>
        <Link
          href="/location"
          className={`px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200 ${
            isActive('/location') && pathname === '/location'
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm ring-2 ring-primary-200 dark:ring-primary-800'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Locations
        </Link>
        <button
          onClick={onPartnershipClick}
          className="px-5 py-2.5 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        >
          Partnership
        </button>
      </div>
    </nav>
  )
}
