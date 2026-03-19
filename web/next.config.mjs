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
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${BACKEND}/media/:path*`,
      },
    ]
  },
}

export default nextConfig
