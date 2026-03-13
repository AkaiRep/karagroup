'use client'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import Header from '@/components/Header'
import Snow from '@/components/Snow'
import Footer from '@/components/Footer'

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <CartProvider>
        <Header />
        <div className="relative">
        <Snow />
        <main className="min-h-screen pt-16">
          {children}
        </main>
        <Footer />
        </div>
      </CartProvider>
    </AuthProvider>
  )
}
