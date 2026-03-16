'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import CartDrawer from '@/components/CartDrawer'
import TelegramLoginButton from '@/components/TelegramLoginButton'

export default function Header() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#07080d]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-green-400 tracking-tight">
            KaraShop
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
            <Link href="/contacts" className="hover:text-white transition-colors">Контакты</Link>
            {user && <Link href="/orders" className="hover:text-white transition-colors">Мои заказы</Link>}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Корзина"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {count}
                </span>
              )}
            </button>

            {/* Desktop auth */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  <span className="text-sm text-slate-400">{user.username}</span>
                  {!isTMA && (
                    <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">
                      Выйти
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#229ED9] hover:bg-[#1a8ec4] text-white text-sm rounded-lg transition-colors font-medium"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
                  </svg>
                  Войти
                </button>
              )}
            </div>

            {/* Mobile burger */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Меню"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#07080d]/95 px-4 py-4 flex flex-col gap-3">
            <Link href="/faq" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">FAQ</Link>
            <Link href="/contacts" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">Контакты</Link>
            {user && <Link href="/orders" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">Мои заказы</Link>}
            <div className="pt-2 border-t border-white/5">
              {user ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{user.username}</span>
                  {!isTMA && (
                    <button onClick={() => { logout(); setMenuOpen(false) }} className="text-sm text-red-400 hover:text-red-300 transition-colors">
                      Выйти
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setAuthOpen(true); setMenuOpen(false) }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#229ED9] hover:bg-[#1a8ec4] text-white text-sm rounded-xl transition-colors font-medium"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
                  </svg>
                  Войти через Telegram
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setAuthOpen(false)}
        >
          <div
            className="bg-[#111318] border border-white/10 rounded-2xl p-6 md:p-8 max-w-sm w-full mx-4 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Вход в аккаунт</h2>
            <p className="text-slate-400 text-sm mb-6">Войдите через Telegram для оформления заказа</p>
            <div className="flex justify-center">
              <TelegramLoginButton onSuccess={() => setAuthOpen(false)} />
            </div>
            <button
              onClick={() => setAuthOpen(false)}
              className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </>
  )
}
