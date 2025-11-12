import { Metadata } from 'next'
import { getAllLocationSlugs } from '../../lib/locations'
import LocationsListClient from '../../components/LocationsListClient'

export const metadata: Metadata = {
  title: 'Filming Locations - Explore Movie & TV Show Filming Locations Worldwide',
  description: 'Discover where your favorite movies and TV shows were filmed. Browse our comprehensive database of filming locations from around the world.',
  openGraph: {
    title: 'Filming Locations - Movie & TV Show Filming Locations',
    description: 'Explore filming locations from movies and TV shows worldwide',
    type: 'website',
  },
}

/**
 * Locations listing page - Shows all available filming location pages
 */
export default function LocationsPage() {
  const locations = getAllLocationSlugs()

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Filming Locations',
    description: 'Browse all filming locations from movies and TV shows',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'}/location`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Locations',
          item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'}/location`,
        },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <LocationsListClient locations={locations} />
    </>
  )
}
