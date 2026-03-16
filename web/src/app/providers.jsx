'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import Header from '@/components/Header'
import Snow from '@/components/Snow'
import Footer from '@/components/Footer'

function NoCopy() {
  useEffect(() => {
    const block = (e) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
    }
  }, [])
  return null
}

export default function Providers({ children }) {
  const pathname = usePathname()

  return (
    <AuthProvider>
      <CartProvider>
        <NoCopy />
        <Header />
        <div className="relative">
        {pathname !== '/faq' && <Snow />}
        <main className="min-h-screen pt-16">
          {children}
        </main>
        <Footer />
        </div>
      </CartProvider>
    </AuthProvider>
  )
}
