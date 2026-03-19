/** @type {import('next').NextConfig} */
// BACKEND_URL — приватный env только для сервера (адрес бэкенда напрямую)
// NEXT_PUBLIC_API_URL — публичный, должен совпадать с доменом фронта (для клиентских запросов через прокси)
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*',          destination: `${BACKEND}/api/:path*` },
      { source: '/media/:path*',        destination: `${BACKEND}/media/:path*` },
      { source: '/auth/:path*',         destination: `${BACKEND}/auth/:path*` },
      { source: '/categories/:path*',   destination: `${BACKEND}/categories/:path*` },
      { source: '/products/:path*',     destination: `${BACKEND}/products/:path*` },
      { source: '/orders/:path*',       destination: `${BACKEND}/orders/:path*` },
      { source: '/payments/:path*',     destination: `${BACKEND}/payments/:path*` },
      { source: '/reviews/:path*',      destination: `${BACKEND}/reviews/:path*` },
      { source: '/site-settings/:path*',destination: `${BACKEND}/site-settings/:path*` },
      { source: '/chat/:path*',         destination: `${BACKEND}/chat/:path*` },
      { source: '/global-chat/:path*',  destination: `${BACKEND}/global-chat/:path*` },
      { source: '/faq/:path*',          destination: `${BACKEND}/faq/:path*` },
      { source: '/health/:path*',       destination: `${BACKEND}/health/:path*` },
      { source: '/uploads/:path*',      destination: `${BACKEND}/uploads/:path*` },
    ]
  },
}

export default nextConfig
