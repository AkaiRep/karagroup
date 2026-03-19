const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://karashop.ru'
const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default async function sitemap() {
  const static_pages = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/contacts`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/refunds`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/offer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]

  let posts = []
  try {
    const res = await fetch(`${API_URL}/api/blog/`, { next: { revalidate: 3600 } })
    if (res.ok) posts = await res.json()
  } catch {}

  const post_pages = posts.map(post => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...static_pages, ...post_pages]
}
