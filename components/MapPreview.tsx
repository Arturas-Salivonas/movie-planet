'use client'

/**
 * MapPreview - Simple map preview showing movie locations
 * Client-only component
 */

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { Movie } from '../lib/types'

interface MapPreviewProps {
  movie: Movie
  selectedLocationIndex?: number
}

export default function MapPreview({ movie, selectedLocationIndex = 0 }: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
      zoom: 3,
      center: [0, 20],
    })

    map.current.on('load', () => {
      if (!map.current) return

      // Add markers for all locations
      movie.locations.forEach((location, index) => {
        const el = document.createElement('div')
        el.className = 'map-marker'
        el.style.width = '40px'
        el.style.height = '40px'
        el.style.borderRadius = '50%'
        el.style.backgroundColor = index === selectedLocationIndex ? '#10be50' : '#3B82F6'
        el.style.border = '3px solid white'
        el.style.cursor = 'pointer'
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'

        new maplibregl.Marker({ element: el })
          .setLngLat([location.lng, location.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 8px;">
                  <strong>${location.city}, ${location.country}</strong>
                  ${location.description ? `<p style="margin-top: 4px; font-size: 12px;">${location.description}</p>` : ''}
                </div>
              `)
          )
          .addTo(map.current!)
      })

      // Fit map to show all locations
      if (movie.locations.length > 0) {
        const bounds = new maplibregl.LngLatBounds()
        movie.locations.forEach(loc => {
          bounds.extend([loc.lng, loc.lat])
        })

        map.current!.fitBounds(bounds, {
          padding: 50,
          maxZoom: movie.locations.length === 1 ? 10 : 6,
        })
      }
    })

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [movie])

  // Update selected location
  useEffect(() => {
    if (!map.current || movie.locations.length === 0) return

    const location = movie.locations[selectedLocationIndex]
    if (location) {
      map.current.flyTo({
        center: [location.lng, location.lat],
        zoom: 12,
        duration: 1500,
      })
    }
  }, [selectedLocationIndex, movie])

  return (
    <div
      ref={mapContainer}
      className="w-full h-96 rounded-lg overflow-hidden shadow-xl"
      style={{ minHeight: '400px' }}
    />
  )
}
