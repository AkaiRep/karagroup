import './globals.css'
import Providers from './providers'

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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
