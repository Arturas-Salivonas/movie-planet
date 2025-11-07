/**
 * Slug generation utilities for movie URLs
 * Handles special characters, accents, and duplicate titles
 */

/**
 * Generate a URL-friendly slug from a movie title
 * Examples:
 *   "The Shawshank Redemption" → "the-shawshank-redemption"
 *   "The Godfather: Part II" → "the-godfather-part-ii"
 *   "Amélie" → "amelie"
 *   "12 Angry Men" → "12-angry-men"
 */
export function generateSlug(title: string, year?: number): string {
  let slug = title
    .toLowerCase()
    // Normalize unicode characters (handle accents like é → e)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    // Replace common special characters
    .replace(/[&]/g, 'and')
    .replace(/[@]/g, 'at')
    // Remove all non-alphanumeric characters except spaces and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace multiple spaces with single hyphen
    .replace(/\s+/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
    // Truncate if too long (for URL safety)
    .substring(0, 100)

  // Add year suffix if provided (for duplicate titles)
  if (year) {
    slug = `${slug}-${year}`
  }

  return slug
}

/**
 * Validate that a slug is URL-safe
 */
export function isValidSlug(slug: string): boolean {
  // Only lowercase letters, numbers, and hyphens
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 150
}

/**
 * Extract movie info from slug
 * Example: "the-godfather-1972" → { title: "the-godfather", year: 1972 }
 */
export function parseSlug(slug: string): { baseSlug: string; year?: number } {
  const yearMatch = slug.match(/-(\d{4})$/)

  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10)
    // Validate it's a reasonable year (1888-2100)
    if (year >= 1888 && year <= 2100) {
      return {
        baseSlug: slug.replace(/-\d{4}$/, ''),
        year
      }
    }
  }

  return { baseSlug: slug }
}

/**
 * Generate multiple slug variations for handling duplicates
 */
export function generateSlugVariations(
  title: string,
  year: number,
  originalTitle?: string
): string[] {
  const variations: string[] = []

  // Primary slug
  variations.push(generateSlug(title))

  // With year
  variations.push(generateSlug(title, year))

  // With original title if different
  if (originalTitle && originalTitle !== title) {
    variations.push(generateSlug(originalTitle))
    variations.push(generateSlug(originalTitle, year))
  }

  return [...new Set(variations)] // Remove duplicates
}
