'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCart } from '@/context/CartContext'
import { useLocale } from '@/context/LocaleContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useAuth } from '@/context/AuthContext'
import { BASE } from '@/lib/api'

function SubregionModal({ product, discount, onAdd, onClose }) {
  const subregions = product.subregions || []
  const [selected, setSelected] = useState(subregions.map((s) => s.id))

  const toggle = (id) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const discounted = (price) => discount > 0 ? Math.round(price * (1 - discount / 100) * 100) / 100 : price

  const selectedSubs = subregions.filter((s) => selected.includes(s.id))
  const total = selectedSubs.reduce((sum, s) => sum + discounted(s.price), 0)

  const allSelected = subregions.length > 0 && subregions.every((s) => selected.includes(s.id))
  const toggleAll = () => allSelected ? setSelected([]) : setSelected(subregions.map((s) => s.id))

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full md:max-w-md bg-[#0d0f15] border border-white/10 rounded-t-2xl md:rounded-2xl p-5 max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-white">{product.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Выберите регионы для зачистки</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors ml-4 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Select all */}
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 mb-3 flex-shrink-0 group w-fit"
        >
          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
            allSelected ? 'bg-green-500 border-green-500' : 'border-slate-600 group-hover:border-green-500/60'
          }`}>
            {allSelected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm text-slate-400 group-hover:text-white transition-colors">
            {allSelected ? 'Снять все' : 'Выбрать все'}
          </span>
        </button>

        {/* List */}
        <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
          {subregions.map((s) => {
            const finalPrice = discounted(s.price)
            const isSelected = selected.includes(s.id)
            return (
              <label
                key={s.id}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? 'bg-green-500/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    onClick={() => toggle(s.id)}
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                      isSelected ? 'bg-green-500 border-green-500' : 'border-slate-600'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {s.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {discount > 0 && (
                    <span className="text-xs text-slate-600 line-through">{s.price.toLocaleString('ru-RU')} ₽</span>
                  )}
                  <span className={`text-sm font-semibold ${isSelected ? 'text-green-400' : 'text-white'}`}>
                    {finalPrice.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/5 flex-shrink-0 mt-3">
          {total > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">
                Итого{discount > 0 ? <span className="text-green-400 ml-1">-{discount}%</span> : ''}
              </span>
              <span className="text-lg font-bold text-green-400">{total.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
          <button
            disabled={selected.length === 0}
            onClick={() => { onAdd(selectedSubs, discount); onClose() }}
            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {selected.length === 0 ? 'Выберите хотя бы один регион' : `Добавить в корзину (${selected.length})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const DESC_THRESHOLD = 110

export default function ProductCard({ product, globalDiscount = 0, isTop = false, animationDelay = 0 }) {
  const { cart, addItem, addClearanceItem, setQty } = useCart()
  const { t } = useLocale()
  const { user } = useAuth()
  const isStaff = user?.role === 'worker' || user?.role === 'admin'
  const { getProductPrice, getProductCurrency, formatAmount } = useCurrency()
  const [descExpanded, setDescExpanded] = useState(false)
  const [clamped, setClamped] = useState(true)
  const [collapsedHeight, setCollapsedHeight] = useState(null)
  const [showSubregions, setShowSubregions] = useState(false)
  const descRef = useRef(null)
  const collapseTimer = useRef(null)
  const item = cart[product.id]
  const inCart = !!item
  const qty = item?.quantity || 0

  useEffect(() => {
    if (!descRef.current) return
    const lh = parseFloat(getComputedStyle(descRef.current).lineHeight)
    const lines = window.innerWidth >= 768 ? 3 : 2
    setCollapsedHeight(`${lh * lines}px`)
  }, [])

  const effectiveDiscount = Math.max(product.discount_percent || 0, globalDiscount)
  const basePrice = isStaff ? product.price : getProductPrice(product)
  const productCurrency = isStaff ? 'RUB' : getProductCurrency(product)
  const discountedPrice = effectiveDiscount > 0 ? basePrice * (1 - effectiveDiscount / 100) : null
  const displayPrice = discountedPrice ?? basePrice

  return (
    <div
      className="relative overflow-hidden bg-[#111318] border border-white/5 rounded-2xl flex flex-col hover:border-green-500/30 transition-all duration-200 group"
      style={{ animation: `fadeInUp 0.35s ease both`, animationDelay: `${animationDelay}ms` }}
    >
      {/* Background image */}
      {(() => {
        const imgUrl = product.image_url
          ? `${BASE.replace(/\/$/, '')}${product.image_url}`
          : null
        return (
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 opacity-50 group-hover:opacity-60 transition-opacity duration-300"
            style={{
              backgroundImage: imgUrl ? `url('${imgUrl}')` : "url('/card-bg.jpg')",
            }}
          />
        )
      })()}
      <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-[#111318]/40 to-transparent" />

      {/* Top badge */}
      {isTop && (
        <div className="absolute top-3 right-3 z-20">
          <span className="flex items-center gap-0.5 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            {t('product.top')}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-3 md:p-5 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <div className="mb-0.5">
            {product.category_name && (
              <span className="text-[10px] md:text-xs text-green-400/80 font-medium uppercase tracking-wide">{product.category_name}</span>
            )}
          </div>
          <h3 className="text-sm md:text-base font-semibold mt-0.5 mb-1 group-hover:text-green-300 transition-colors leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <div>
              <div
                className={descExpanded ? 'desc-expanded' : 'desc-collapsed'}
                style={descExpanded
                  ? { maxHeight: descRef.current?.scrollHeight + 'px' }
                  : collapsedHeight ? { maxHeight: collapsedHeight } : {}}
              >
                <p ref={descRef} className={`text-xs md:text-sm text-slate-400 leading-relaxed ${clamped ? 'line-clamp-2 md:line-clamp-3' : ''}`}>
                  {product.description}
                </p>
              </div>
              {product.description.length > DESC_THRESHOLD && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    clearTimeout(collapseTimer.current)
                    if (descExpanded) {
                      setDescExpanded(false)
                      collapseTimer.current = setTimeout(() => setClamped(true), 300)
                    } else {
                      setClamped(false)
                      setDescExpanded(true)
                    }
                  }}
                  className="text-[11px] text-green-400/80 hover:text-green-400 mt-1 transition-colors"
                >
                  {descExpanded ? t('product.showLess') : t('product.showMore')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base md:text-xl font-bold text-white">
              {formatAmount(displayPrice, productCurrency)}
            </span>
            {effectiveDiscount > 0 && (
              <>
                <span className="text-xs text-slate-500 line-through">
                  {formatAmount(basePrice, productCurrency)}
                </span>
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
                  -{effectiveDiscount}%
                </span>
              </>
            )}
          </div>

          {product.is_clearance && !isStaff ? (
            <div className="space-y-2">
              {showSubregions && (
                <SubregionModal
                  product={product}
                  discount={effectiveDiscount}
                  onAdd={(subs, disc) => addClearanceItem(product, subs, disc)}
                  onClose={() => setShowSubregions(false)}
                />
              )}
              {inCart ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 truncate">
                    {item.selectedSubregions?.map((s) => s.name).join(', ')}
                  </span>
                  <button
                    onClick={() => setQty(product.id, 0)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                  >Убрать</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubregions(true)}
                  className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs md:text-sm font-medium transition-colors"
                >
                  Выбрать регионы
                </button>
              )}
            </div>
          ) : inCart ? (
            <div className="flex items-center justify-between bg-black/30 rounded-xl px-2 py-1">
              <button
                onClick={() => setQty(product.id, qty - 1)}
                className="w-7 h-7 flex items-center justify-center hover:text-red-400 text-slate-300 rounded-lg transition-colors text-lg font-medium"
              >−</button>
              <span className="text-sm font-semibold text-green-400">{qty}</span>
              <button
                onClick={() => setQty(product.id, qty + 1)}
                className="w-7 h-7 flex items-center justify-center hover:text-green-400 text-slate-300 rounded-lg transition-colors text-lg font-medium"
              >+</button>
            </div>
          ) : (
            <button
              onClick={() => addItem(product)}
              className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs md:text-sm font-medium transition-colors"
            >
              {t('product.addToCart')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
