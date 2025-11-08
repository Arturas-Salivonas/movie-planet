import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  getMovieBySlug,
  getAllMovieSlugs,
} from '../../../lib/movies'
import { generateMovieMetadata } from '../../../lib/metadata'

interface Props {
  params: { slug: string }
}

// Enable static site generation for all movies
export async function generateStaticParams() {
  const slugs = getAllMovieSlugs()
  return slugs.map((slug) => ({
    slug: slug,
  }))
}

// Generate metadata for each movie page (SEO)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = getMovieBySlug(params.slug)

  if (!movie) {
    return {
      title: 'Movie Not Found | filmingmap',
      description: 'The requested movie could not be found.',
    }
  }

  return generateMovieMetadata(movie, params.slug)
}

// Server component - redirects to home with query param
export default function MovieRoute({ params }: Props) {
  const movie = getMovieBySlug(params.slug)

  // 404 if movie not found
  if (!movie) {
    notFound()
  }

  // Redirect to homepage with movie query param
  // This keeps SEO benefits but prevents remounting
  redirect(`/?movie=${params.slug}`)
}
