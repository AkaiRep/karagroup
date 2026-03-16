const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://karashop.ru'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/orders', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
