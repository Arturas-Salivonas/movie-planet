/**
 * Hook for initializing MapLibre GL map with globe projection
 */

import { useEffect, useRef, MutableRefObject } from 'react'
import maplibregl from 'maplibre-gl'

interface UseMapInitializationProps {
  mapContainer: MutableRefObject<HTMLDivElement | null>
}

export function useMapInitialization({ mapContainer }: UseMapInitializationProps) {
  const map = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/streets-v4/style.json?key=q4aOhsVX264foFexJ7ga',
      zoom: 2.5,
      center: [0.35, 43], // Centered on Europe
      maxPitch: 85,
      refreshExpiredTiles: false,
      fadeDuration: 150,
      renderWorldCopies: false
    })

    map.current.on('style.load', () => {
      if (map.current) {
        // Set projection to globe
        (map.current as any).setProjection({
          type: 'globe',
        })

        // Restore center position from localStorage
        if (typeof window !== 'undefined') {
          const savedState = localStorage.getItem('filmingmap_view')
          if (savedState) {
            try {
              const { lat, lng } = JSON.parse(savedState)
              map.current.setCenter([lng, lat])
            } catch (e) {
              // Ignore invalid stored state
            }
          }
        }
      }
    })

    // Save map position to localStorage on movement (debounced)
    let saveTimeout: NodeJS.Timeout | null = null
    const saveMapState = () => {
      if (!map.current || typeof window === 'undefined') return
      const center = map.current.getCenter()
      const zoom = map.current.getZoom()
      localStorage.setItem('filmingmap_view', JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        zoom: zoom
      }))
    }

    map.current.on('moveend', () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveMapState, 500)
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.current.addControl(new maplibregl.FullscreenControl(), 'bottom-right')

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapContainer])

  return { map }
}
