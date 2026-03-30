'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useLocale, AVAILABLE_LOCALES } from '@/context/LocaleContext'
import { useCurrency, CURRENCIES } from '@/context/CurrencyContext'
import CartDrawer from '@/components/CartDrawer'

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = AVAILABLE_LOCALES.find(l => l.code === locale)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white bg-[#111318] border border-white/10 hover:border-white/20 rounded-lg transition-colors font-medium"
      >
        <span>{current?.flag}</span>
        <span>{current?.label}</span>
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#111318] border border-white/10 rounded-xl overflow-hidden shadow-xl z-50 min-w-[90px]">
          {AVAILABLE_LOCALES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5 ${locale === l.code ? 'text-green-400' : 'text-slate-300'}`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {locale === l.code && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CurrencySwitcher() {
  const { currency, setCurrency, currencies, isStaff } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white bg-[#111318] border border-white/10 hover:border-white/20 rounded-lg transition-colors font-medium"
      >
        <span>{CURRENCIES[currency]?.symbol}</span>
        <span>{currency}</span>
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && !isStaff && (
        <div className="absolute right-0 top-full mt-1 bg-[#111318] border border-white/10 rounded-xl overflow-hidden shadow-xl z-50 min-w-[100px]">
          {currencies.map(c => (
            <button
              key={c.code}
              onClick={() => { setCurrency(c.code); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5 ${currency === c.code ? 'text-green-400' : 'text-slate-300'}`}
            >
              <span className="font-bold w-4">{c.symbol}</span>
              <span>{c.code}</span>
              {currency === c.code && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const { t } = useLocale()
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData
  const menuRef = useRef(null)
  const [menuHeight, setMenuHeight] = useState(0)

  useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(menuOpen ? menuRef.current.scrollHeight : 0)
    }
  }, [menuOpen])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#07080d]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="text-xl font-bold text-green-400 tracking-tight flex-shrink-0">
            KaraShop
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm text-slate-400">
            <Link href="/blog" className="hover:text-white transition-colors">{t('nav.blog')}</Link>
            <Link href="/faq" className="hover:text-white transition-colors">{t('nav.faq')}</Link>
            <Link href="/contacts" className="hover:text-white transition-colors">{t('nav.contacts')}</Link>
            {user && <Link href="/orders" className="hover:text-white transition-colors">{t('nav.myOrders')}</Link>}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            {/* Locale + Currency switchers (desktop) */}
            <div className="hidden md:flex items-center gap-1.5">
              <LocaleSwitcher />
              {!isStaff && <CurrencySwitcher />}
            </div>

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Cart"
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
                  <Link
                    href="/profile"
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {!user.telegram_id && (
                      <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" title="Link Telegram" />
                    )}
                    {user.username}
                  </Link>
                  {!isTMA && (
                    <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">
                      {t('nav.logout')}
                    </button>
                  )}
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2130] hover:bg-green-500/10 border border-white/10 hover:border-green-500/40 text-slate-300 hover:text-white text-sm rounded-lg transition-all font-medium"
                >
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {t('nav.login')}
                </Link>
              )}
            </div>

            {/* Mobile burger */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Menu"
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
        <div
          style={{ height: menuHeight, transition: 'height 0.25s ease', overflow: 'hidden' }}
          className="md:hidden"
        >
          <div ref={menuRef} className="border-t border-white/5 bg-[#07080d]/95 px-4 py-4 flex flex-col gap-3">
            <Link href="/blog" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">{t('nav.blog')}</Link>
            <Link href="/faq" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">{t('nav.faq')}</Link>
            <Link href="/contacts" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">{t('nav.contacts')}</Link>
            {user && <Link href="/orders" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white py-2 transition-colors">{t('nav.myOrders')}</Link>}

            {/* Language + Currency on mobile */}
            <div className="flex gap-2 pt-1">
              <LocaleSwitcher />
              {!isStaff && <CurrencySwitcher />}
            </div>

            <div className="pt-2 border-t border-white/5">
              {user ? (
                <div className="flex items-center justify-between">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    {!user.telegram_id && (
                      <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                    )}
                    {user.username}
                  </Link>
                  {!isTMA && (
                    <button onClick={() => { logout(); setMenuOpen(false) }} className="text-sm text-red-400 hover:text-red-300 transition-colors">
                      {t('nav.logout')}
                    </button>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e2130] hover:bg-green-500/10 border border-white/10 hover:border-green-500/40 text-slate-300 hover:text-white text-sm rounded-xl transition-all font-medium"
                >
                  {t('nav.login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
