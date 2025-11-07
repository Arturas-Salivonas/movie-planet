import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getMovieBySlug,
  getAllMovieSlugs,
  getRelatedMovies,
} from '../../../lib/movies'
import { generateMovieMetadata, generateMovieSchema } from '../../../lib/metadata'
import MoviePage from '../../../components/MoviePage'

interface Props {
  params: { slug: string }
}

// Enable static site generation for all movies
// This generates pages at build time for better performance
export async function generateStaticParams() {
  const slugs = getAllMovieSlugs()

  // For 10k+ movies, we can use ISR (Incremental Static Regeneration)
  // or generate most popular movies first
  return slugs.map((slug) => ({
    slug: slug,
  }))
}

// Generate metadata for each movie page (SEO)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = getMovieBySlug(params.slug)

  if (!movie) {
    return {
      title: 'Movie Not Found | CineMap',
      description: 'The requested movie could not be found.',
    }
  }

  return generateMovieMetadata(movie, params.slug)
}

// Server component - renders on the server with full HTML
export default function MovieRoute({ params }: Props) {
  const movie = getMovieBySlug(params.slug)

  // 404 if movie not found
  if (!movie) {
    notFound()
  }

  // Get related movies for recommendations
  const relatedMovies = getRelatedMovies(movie, 6)

  // Generate JSON-LD schema
  const schema = generateMovieSchema(movie, params.slug)

  return (
    <>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Movie page content */}
      <MoviePage
        movie={movie}
        slug={params.slug}
        relatedMovies={relatedMovies}
      />
    </>
  )
}

// Optional: Configure revalidation for ISR
// export const revalidate = 86400 // Revalidate every 24 hours
