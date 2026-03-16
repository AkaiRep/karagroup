const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://karashop.ru'

export default function sitemap() {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/contacts`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/refunds`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/offer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]
}
