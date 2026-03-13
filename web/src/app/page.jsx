'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import ProductCard from '@/components/ProductCard'

const FEATURES = [
  { icon: '⚡', title: 'Быстро', desc: 'Начинаем выполнение в течение нескольких часов после оплаты' },
  { icon: '🛡️', title: 'Безопасно', desc: 'Работаем через VPN, аккаунт под защитой' },
  { icon: '✅', title: 'С гарантией', desc: 'Не выполним — вернём деньги' },
  { icon: '💬', title: 'Поддержка 24/7', desc: 'Всегда на связи в Telegram' },
]

export default function CatalogPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getProducts(), api.getCategories()])
      .then(([prods, cats]) => {
        setProducts(prods)
        setCategories(cats)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center"
          style={{
            backgroundImage: "url('/hero-bg.jpg')",
            filter: 'blur(6px)',
          }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#07080d]/75" />
        {/* Gradient fade bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#07080d] via-[#07080d]/60 to-transparent" />

        {/* Content */}
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

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-[#111318] border border-white/5 rounded-2xl p-5 text-center hover:border-green-500/20 transition-colors">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="max-w-6xl mx-auto pb-16">
        <div className="px-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Каталог услуг</h2>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Выберите нужную услугу и добавьте в корзину</p>
        </div>

        {/* Category filter — горизонтальный скролл на мобиле */}
        {categories.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar px-4 pb-1">
            <button
              onClick={() => setActiveCategory(null)}
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
                onClick={() => setActiveCategory(cat.id)}
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
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="px-4 space-y-8">
            {categories
              .filter(cat => products.some(p => p.category_id === cat.id))
              .map(cat => {
                const catProducts = products.filter(p => p.category_id === cat.id)
                return (
                  <div key={cat.id}>
                    {/* Разделитель */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                      <span className="text-sm font-semibold text-green-400 uppercase tracking-widest px-2">
                        {cat.name}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </div>
                )
              })
            }
            {/* Товары без категории */}
            {products.filter(p => !p.category_id).length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest px-2">Другое</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {products.filter(p => !p.category_id).map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* About */}
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
    </div>
  )
}
