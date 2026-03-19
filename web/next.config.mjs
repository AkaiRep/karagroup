/** @type {import('next').NextConfig} */
// BACKEND_URL — приватный env только для сервера (адрес бэкенда напрямую)
// NEXT_PUBLIC_API_URL — публичный, должен совпадать с доменом фронта (для клиентских запросов через прокси)
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
}

export default nextConfig
