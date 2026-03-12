'use client'
import { useCart } from '@/context/CartContext'

export default function ProductCard({ product }) {
  const { cart, addItem, removeItem } = useCart()
  const inCart = !!cart[product.id]

  const discountedPrice = product.discount_percent
    ? product.price * (1 - product.discount_percent / 100)
    : null

  const displayPrice = discountedPrice ?? product.price

  return (
    <div className="bg-[#111318] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 hover:border-green-500/30 transition-all duration-200 group">
      <div className="flex-1">
        {product.category_name && (
          <span className="text-xs text-green-400/80 font-medium uppercase tracking-wide">
            {product.category_name}
          </span>
        )}
        <h3 className="text-base font-semibold mt-1 mb-2 group-hover:text-green-300 transition-colors">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
            {product.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-white">
            {displayPrice.toLocaleString('ru-RU')} ₽
          </span>
          {product.discount_percent > 0 && (
            <>
              <span className="text-sm text-slate-500 line-through">
                {product.price.toLocaleString('ru-RU')} ₽
              </span>
              <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
                -{product.discount_percent}%
              </span>
            </>
          )}
        </div>

        {inCart ? (
          <button
            onClick={() => removeItem(product.id)}
            className="flex-shrink-0 px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            Убрать
          </button>
        ) : (
          <button
            onClick={() => addItem(product)}
            className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            В корзину
          </button>
        )}
      </div>
    </div>
  )
}
