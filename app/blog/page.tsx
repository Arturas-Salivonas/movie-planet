import { Metadata } from 'next'
import BlogClient from '../../components/BlogClient'

export const metadata: Metadata = {
  title: 'Blog - Coming Soon | FilmingMap',
  description: 'Stay tuned for behind-the-scenes stories, filming location guides, and movie tourism insights.',
  openGraph: {
    title: 'Blog - Coming Soon | FilmingMap',
    description: 'Stay tuned for behind-the-scenes stories and filming location guides',
    type: 'website',
  },
}

export default function BlogPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'FilmingMap Blog',
    description: 'Behind-the-scenes stories, filming location guides, and movie tourism insights',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'}/blog`,
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
          name: 'Blog',
          item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'}/blog`,
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

      <BlogClient />
    </>
  )
}
