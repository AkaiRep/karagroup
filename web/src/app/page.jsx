'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import ProductCard from '@/components/ProductCard'
import ReviewsCarousel from '@/components/ReviewsCarousel'

const GUARANTEES = [
  'Безопасность аккаунта — работаем с использованием VPN',
  'Гарантия результата или возврат средств',
  'Оперативное выполнение заказов',
  'Поддержка 24/7 в Telegram',
]

export default function CatalogPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState({})
  const [isMobile, setIsMobile] = useState(false)
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [catalogVisible, setCatalogVisible] = useState(true)
  const [recentOrders, setRecentOrders] = useState([])
  const heroBgRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Parallax
  useEffect(() => {
    const onScroll = () => {
      if (heroBgRef.current) {
        heroBgRef.current.style.transform = `translateY(${window.scrollY * 0.35}px) scale(1.15)`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const PAGE_INIT = isMobile ? 4 : 3
  const PAGE_MORE = isMobile ? 8 : 6

  const getVisible = (catId) => visibleCount[catId] ?? PAGE_INIT
  const showMore = (catId) => setVisibleCount(v => ({ ...v, [catId]: (v[catId] ?? PAGE_INIT) + PAGE_MORE }))

  const switchCategory = (catId) => {
    setCatalogVisible(false)
    setTimeout(() => {
      setActiveCategory(catId)
      setVisibleCount({})
      requestAnimationFrame(() => requestAnimationFrame(() => setCatalogVisible(true)))
    }, 100)
  }

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .replace(/^https/, 'wss')
      .replace(/^http/, 'ws')
    let alive = true

    const connect = () => {
      if (!alive) return
      const ws = new WebSocket(`${base}/orders/ws/recent`)
      wsRef.current = ws
      ws.onmessage = (e) => {
        try {
          const order = JSON.parse(e.data)
          setRecentOrders(prev => [order, ...prev].slice(0, 10))
        } catch {}
      }
      ws.onclose = () => {
        if (alive) setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      alive = false
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    Promise.all([api.getProducts(), api.getCategories(), api.getGlobalDiscount(), api.getRecentOrders()])
      .then(([prods, cats, disc, recent]) => {
        setProducts(prods)
        setCategories(cats)
        setGlobalDiscount(disc.value || 0)
        setRecentOrders(recent || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products

  const channel = process.env.NEXT_PUBLIC_BOT_CHANNEL
  const manager = process.env.NEXT_PUBLIC_MANAGER

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center overflow-hidden">
        <div
          ref={heroBgRef}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/hero-bg.jpg')",
            filter: 'blur(6px)',
            transform: 'scale(1.15)',
            willChange: 'transform',
          }}
        />
        <div className="absolute inset-0 bg-[#07080d]/75" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#07080d] via-[#07080d]/60 to-transparent" />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-1.5 rounded-full mb-6 font-medium">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Принимаем заказы
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 md:mb-6 leading-tight">
            Профессиональный{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              игровой буст
            </span>
          </h1>
          <p className="text-slate-300 text-base md:text-xl leading-relaxed mb-6 md:mb-8 max-w-xl mx-auto">
            Поднимем ваш ранг быстро и безопасно. Работаем с топовыми игроками, гарантируем результат.
          </p>
          <a
            href="#catalog"
            className="inline-flex items-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-2xl transition-colors text-base md:text-lg"
          >
            Смотреть услуги
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>

        </div>

      </section>

      {recentOrders.length > 0 && (
        <div className="w-full py-4 px-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 text-center">Последние заказы</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {recentOrders.map(order => (
              <div
                key={order.id}
                className="flex-shrink-0 bg-white/10 border border-white/15 rounded-2xl px-4 py-3 flex flex-col gap-1 min-w-[180px]"
              >
                <span className="text-slate-400 font-mono text-xs whitespace-nowrap">
                  {order.client || 'Клиент'}
                </span>
                <span className="text-white font-medium text-sm whitespace-nowrap">
                  {order.product}
                  {order.extra_count > 0 && (
                    <span className="text-slate-400 font-normal"> (+{order.extra_count})</span>
                  )}
                </span>
                <span className="text-green-300 font-semibold text-sm whitespace-nowrap">{order.price} ₽</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-3 text-green-400">Кто мы</h2>
            <p className="text-slate-400 leading-relaxed">
              KaraShop — профессиональный сервис буста игровых аккаунтов. Мы работаем с опытными игроками,
              которые помогут вам достичь желаемого ранга быстро и безопасно.
            </p>
          </div>

          <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-green-400">Наши гарантии</h2>
            <ul className="space-y-3">
              {GUARANTEES.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="max-w-6xl mx-auto pb-16">
        <div className="px-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Каталог услуг</h2>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Выберите нужную услугу и добавьте в корзину</p>
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar px-4 pb-1">
            <button
              onClick={() => switchCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === null
                  ? 'bg-green-600 text-white'
                  : 'bg-[#111318] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              Все
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => switchCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-green-600 text-white'
                    : 'bg-[#111318] text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div
          style={{ transition: 'opacity 0.12s ease, transform 0.12s ease', opacity: catalogVisible ? 1 : 0, transform: catalogVisible ? 'translateY(0)' : 'translateY(6px)' }}
        >
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#111318] rounded-2xl h-48 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">Услуги не найдены</div>
        ) : activeCategory !== null ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} globalDiscount={globalDiscount} />
            ))}
          </div>
        ) : (
          <div className="px-4 space-y-8">
            {categories
              .filter(cat => products.some(p => p.category_id === cat.id))
              .map(cat => {
                const catProducts = products.filter(p => p.category_id === cat.id)
                const visible = getVisible(cat.id)
                const shown = catProducts.slice(0, visible)
                const hasMore = catProducts.length > visible
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                      <span className="text-sm font-semibold text-green-400 uppercase tracking-widest px-2">
                        {cat.name}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {shown.map(product => (
                        <ProductCard key={product.id} product={product} globalDiscount={globalDiscount} />
                      ))}
                    </div>
                    {hasMore && (
                      <button
                        onClick={() => showMore(cat.id)}
                        className="mt-4 w-full py-2.5 border border-white/10 hover:border-green-500/30 text-slate-400 hover:text-green-400 rounded-xl text-sm font-medium transition-colors"
                      >
                        Загрузить ещё ({catProducts.length - visible})
                      </button>
                    )}
                  </div>
                )
              })
            }
            {products.filter(p => !p.category_id).length > 0 && (() => {
              const uncatProducts = products.filter(p => !p.category_id)
              const visible = getVisible('uncategorized')
              const shown = uncatProducts.slice(0, visible)
              const hasMore = uncatProducts.length > visible
              return (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest px-2">Другое</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shown.map(product => (
                      <ProductCard key={product.id} product={product} globalDiscount={globalDiscount} />
                    ))}
                  </div>
                  {hasMore && (
                    <button
                      onClick={() => showMore('uncategorized')}
                      className="mt-4 w-full py-2.5 border border-white/10 hover:border-green-500/30 text-slate-400 hover:text-green-400 rounded-xl text-sm font-medium transition-colors"
                    >
                      Загрузить ещё ({uncatProducts.length - visible})
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        )}
        </div>
      </section>

      <ReviewsCarousel />

      {/* Stats */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080d] via-transparent to-[#07080d]" style={{zIndex: 1}} />
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center"
          style={{ backgroundImage: "url('/footer-bg.jpg')", filter: 'blur(8px)' }}
        />
        <div className="absolute inset-0 bg-[#07080d]/55" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Почему выбирают нас</h2>
          <p className="text-slate-300 text-base md:text-lg mb-8 md:mb-12 max-w-2xl mx-auto">
            Мы — команда профессиональных игроков с многолетним опытом. Ценим доверие каждого клиента.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 text-left">
            {[
              { num: '500+', label: 'Выполненных заказов', desc: 'За всё время работы' },
              { num: '100%', label: 'Гарантия результата', desc: 'Или вернём деньги' },
              { num: '<2ч', label: 'Время отклика', desc: 'Начинаем работу быстро' },
            ].map(s => (
              <div key={s.num} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <div className="text-4xl font-bold text-green-400 mb-2">{s.num}</div>
                <div className="font-semibold mb-1">{s.label}</div>
                <div className="text-slate-400 text-sm">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contacts */}
      {(channel || manager) && (
        <section className="max-w-4xl mx-auto px-4 pb-16">
          <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-green-400">Контакты</h2>
            <div className="flex flex-wrap gap-4">
              {channel && (
                <a href={channel} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[#229ED9] hover:text-white transition-colors">
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
                  </svg>
                  Наш Telegram-канал
                </a>
              )}
              {manager && (
                <a href={`https://t.me/${manager.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[#229ED9] hover:text-white transition-colors">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  Написать менеджеру: {manager}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

    </div>
  )
}
