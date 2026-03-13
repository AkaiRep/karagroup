import './globals.css'
import Providers from './providers'
import Script from 'next/script'

export const metadata = {
  title: 'KaraShop — Буст аккаунтов',
  description: 'Профессиональный буст игровых аккаунтов',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
