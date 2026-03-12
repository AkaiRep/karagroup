'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import ProductCard from '@/components/ProductCard'

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
          Игровой буст
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Профессиональный буст аккаунтов. Быстро, надёжно, с гарантией.
        </p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === null
                ? 'bg-green-600 text-white'
                : 'bg-[#111318] text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            Все услуги
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#111318] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#111318] rounded-2xl p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          Услуги не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
