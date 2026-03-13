'use client'
import { useCart } from '@/context/CartContext'

export default function ProductCard({ product, globalDiscount = 0 }) {
  const { cart, addItem, setQty } = useCart()
  const item = cart[product.id]
  const inCart = !!item
  const qty = item?.quantity || 0

  const effectiveDiscount = Math.max(product.discount_percent || 0, globalDiscount)
  const discountedPrice = effectiveDiscount > 0
    ? product.price * (1 - effectiveDiscount / 100)
    : null

  const displayPrice = discountedPrice ?? product.price

  return (
    <div className="relative overflow-hidden bg-[#111318] border border-white/5 rounded-2xl flex flex-col hover:border-green-500/30 transition-all duration-200 group">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-110 opacity-20 group-hover:opacity-25 transition-opacity duration-300"
        style={{ backgroundImage: "url('/card-bg.jpg')", filter: 'blur(3px)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-[#111318]/70 to-[#111318]/20" />

      {/* Content */}
      <div className="relative z-10 p-3 md:p-5 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          {product.category_name && (
            <span className="text-[10px] md:text-xs text-green-400/80 font-medium uppercase tracking-wide">
              {product.category_name}
            </span>
          )}
          <h3 className="text-sm md:text-base font-semibold mt-0.5 mb-1 group-hover:text-green-300 transition-colors leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed line-clamp-2 md:line-clamp-3">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base md:text-xl font-bold text-white">
              {displayPrice.toLocaleString('ru-RU')} ₽
            </span>
            {effectiveDiscount > 0 && (
              <>
                <span className="text-xs text-slate-500 line-through">
                  {product.price.toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
                  -{effectiveDiscount}%
                </span>
              </>
            )}
          </div>

          {inCart ? (
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
              В корзину
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
