/**
 * Hook for progressive poster loading on the map
 * OPTIMIZED: Uses sprite sheets instead of individual images
 */

import { useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONFeature } from '../utils/map/geoJsonHelpers'

interface SpriteMetadata {
  version: number
  generatedAt: string
  totalMovies: number
  totalSprites: number
  spriteWidth: number
  spriteHeight: number
  iconWidth: number
  iconHeight: number
  sprites: Record<string, {
    x: number
    y: number
    width: number
    height: number
    pixelRatio: number
    sprite: string
  }>
}

export function usePosterLoading() {
  const loadedImagesRef = useRef<Set<string>>(new Set())
  const spriteMetadataRef = useRef<SpriteMetadata | null>(null)
  const loadedSpritesRef = useRef<Set<string>>(new Set())

  /**
   * Load sprite metadata
   */
  const loadSpriteMetadata = useCallback(async () => {
    if (spriteMetadataRef.current) return spriteMetadataRef.current

    try {
      const response = await fetch('/images/sprite-metadata.json')
      if (response.ok) {
        spriteMetadataRef.current = await response.json()
        console.log('✅ Loaded sprite metadata:', {
          movies: spriteMetadataRef.current?.totalMovies,
          sprites: spriteMetadataRef.current?.totalSprites,
        })
      }
    } catch (error) {
      console.warn('⚠️ Failed to load sprite metadata:', error)
    }

    return spriteMetadataRef.current
  }, [])

  /**
   * Load sprite sheet and extract icons
   */
  const loadSpriteSheet = useCallback(async (
    map: maplibregl.Map,
    spriteName: string,
    metadata: SpriteMetadata
  ) => {
    if (loadedSpritesRef.current.has(spriteName)) return

    try {
      const spriteUrl = `/images/sprites/${spriteName}.png`

      // Load sprite image
      const response = await fetch(spriteUrl)
      const blob = await response.blob()
      const imageBitmap = await createImageBitmap(blob)

      // Extract each icon from sprite
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // Find all movies in this sprite
      const moviesInSprite = Object.entries(metadata.sprites)
        .filter(([_, data]) => data.sprite === spriteName)

      for (const [iconName, position] of moviesInSprite) {
        if (loadedImagesRef.current.has(iconName) || map.hasImage(iconName)) {
          continue
        }

        // Set canvas size to icon size
        canvas.width = position.width
        canvas.height = position.height

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Extract icon from sprite
        ctx.drawImage(
          imageBitmap,
          position.x, position.y, position.width, position.height, // Source
          0, 0, position.width, position.height // Destination
        )

        // Add to map
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        if (!map.hasImage(iconName)) {
          map.addImage(iconName, {
            width: canvas.width,
            height: canvas.height,
            data: imageData.data,
          })
          loadedImagesRef.current.add(iconName)
        }
      }

      loadedSpritesRef.current.add(spriteName)
      console.log(`✅ Loaded sprite: ${spriteName} (${moviesInSprite.length} icons)`)
    } catch (error) {
      console.error(`❌ Failed to load sprite ${spriteName}:`, error)
    }
  }, [])

  /**
   * Load icons for visible markers
   */
  const loadVisiblePosters = useCallback(async (
    map: maplibregl.Map,
    _allFeatures: GeoJSONFeature[],
    fallbackIconName: string
  ): Promise<string[]> => {
    if (!map) return []

    // Load metadata
    const metadata = await loadSpriteMetadata()
    if (!metadata) {
      console.warn('⚠️ No sprite metadata available')
      return []
    }

    // Get visible features
    const visibleFeatures = map.queryRenderedFeatures({ layers: ['movie-markers'] })
    if (visibleFeatures.length === 0) return []

    // Get unique movie IDs
    const uniqueMovieIds = new Set<string>()
    visibleFeatures.forEach(f => {
      if (f.properties?.movie_id) {
        uniqueMovieIds.add(f.properties.movie_id)
      }
    })

    // Determine which sprites need to be loaded
    const spritesToLoad = new Set<string>()
    uniqueMovieIds.forEach(movieId => {
      const iconName = `poster-${movieId}`
      const spriteData = metadata.sprites[iconName]

      if (spriteData && !loadedSpritesRef.current.has(spriteData.sprite)) {
        spritesToLoad.add(spriteData.sprite)
      }
    })

    // Load sprites (this loads all icons in each sprite at once)
    if (spritesToLoad.size > 0) {
      console.log(`📦 Loading ${spritesToLoad.size} sprite sheet(s)...`)
      await Promise.all(
        Array.from(spritesToLoad).map(spriteName =>
          loadSpriteSheet(map, spriteName, metadata)
        )
      )
    }

    // Update icon expression
    if (map && map.getLayer('movie-markers')) {
      const allLoadedMovieIds = Array.from(loadedImagesRef.current)
        .map(iconName => iconName.replace('poster-', ''))
        .filter(movieId => {
          const iconName = `poster-${movieId}`
          return map.hasImage(iconName)
        })

      if (allLoadedMovieIds.length > 0) {
        const iconExpression: any = [
          'case',
          ['in', ['get', 'movie_id'], ['literal', allLoadedMovieIds]],
          ['concat', 'poster-', ['get', 'movie_id']],
          fallbackIconName
        ]
        map.setLayoutProperty('movie-markers', 'icon-image', iconExpression)
      }
    }

    return Array.from(uniqueMovieIds)
  }, [loadSpriteMetadata, loadSpriteSheet])

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    loadedImagesRef.current.clear()
    loadedSpritesRef.current.clear()
    spriteMetadataRef.current = null
  }, [])

  return {
    loadVisiblePosters,
    clearCache,
    loadedImagesRef,
    imageCacheRef: useRef({}), // Keep for compatibility
  }
}
