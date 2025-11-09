/**
 * Marker creation utilities for MapLibre GL
 * Handles poster icon generation and caching
 */

/**
 * Create a poster icon with circular crop for map markers
 * Includes browser caching and fallback handling
 */
export async function createPosterIcon(
  posterPath: string | null,
  _movieId: string,
  _isMultiLocation: boolean,
  imageCache: { [key: string]: HTMLImageElement }
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  return new Promise((resolve) => {
    const size = 52 // Size for marker icons
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // If no poster, create fallback icon
    if (!posterPath) {
      // Just show the film icon on transparent background
      ctx.clearRect(0, 0, size, size) // Ensure transparent background

      // Film icon only
      ctx.fillText('🎬', size / 2, size / 2)

      resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
      return
    }

    // Check if image is already cached by PATH (not movieId) to share across movies
    const cacheKey = posterPath
    if (imageCache[cacheKey]) {
      const cachedImg = imageCache[cacheKey]

      // FAST PATH: Reuse cached image with minimal canvas operations
      ctx.save()

      // Clip and draw
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(cachedImg, 0, 0, size, size)
      ctx.restore()

      resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
      return
    }

    // Load poster image with browser caching
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Cache by PATH so all movies with same poster reuse the same Image object
      imageCache[cacheKey] = img

      // Create circular clipping mask
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
      ctx.clip()

      // Draw poster (centered and scaled)
      ctx.drawImage(img, 0, 0, size, size)
      ctx.restore()

      resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
    }

    img.onerror = () => {
      // Fallback on error - just show the film icon
      ctx.clearRect(0, 0, size, size) // Ensure transparent background

      // Film icon fallback
      ctx.fillText('🎬', size / 2, size / 2)

      resolve({ width: size, height: size, data: ctx.getImageData(0, 0, size, size).data })
    }

    // Use the full poster URL from the data - browser will cache it
    img.src = posterPath
  })
}

/**
 * Create a fallback icon for markers without posters
 */
export function createFallbackIcon(size: number = 52): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Just show the film icon on transparent background
  ctx.clearRect(0, 0, size, size)
  ctx.fillText('🎬', size / 2, size / 2)

  return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data }
}
