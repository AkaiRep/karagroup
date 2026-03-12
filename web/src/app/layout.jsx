import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'KaraShop — Буст аккаунтов',
  description: 'Профессиональный буст игровых аккаунтов',
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
