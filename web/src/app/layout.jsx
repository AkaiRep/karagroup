'use client'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import Header from '@/components/Header'

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <title>KaraShop — Буст аккаунтов</title>
        <meta name="description" content="Профессиональный буст игровых аккаунтов" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="min-h-screen pt-16">
              {children}
            </main>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
