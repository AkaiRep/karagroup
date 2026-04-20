'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/lib/api'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState({}) // { [productId]: { ...product, quantity: 1 } }
  const [promo, setPromo] = useState(null)
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [pinnedCatId, setPinnedCatId] = useState(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (saved) setCart(JSON.parse(saved))
    } catch {}
    api.getGlobalDiscount().then(d => setGlobalDiscount(d.value || 0)).catch(() => {})
    api.getSiteSettings().then(s => {
      if (s.pinned_category_id) setPinnedCatId(parseInt(s.pinned_category_id))
    }).catch(() => {})
  }, [])

  const save = (newCart) => {
    setCart(newCart)
    localStorage.setItem('cart', JSON.stringify(newCart))
  }

  const addItem = (product) => {
    const existing = cart[product.id]
    save({ ...cart, [product.id]: { ...product, quantity: existing ? existing.quantity + 1 : 1 } })
  }

  // Для зачисток — добавляет товар с конкретными субрегионами (цена = сумма субрегионов)
  const addClearanceItem = (product, selectedSubregions) => {
    const price = selectedSubregions.reduce((sum, s) => sum + s.price, 0)
    save({
      ...cart,
      [product.id]: {
        ...product,
        price,
        quantity: 1,
        selectedSubregions,
        is_clearance: true,
      },
    })
  }

  const removeItem = (productId) => {
    const next = { ...cart }
    delete next[String(productId)]
    save(next)
    if (Object.keys(next).length === 0) setPromo(null)
  }

  const setQty = (productId, qty) => {
    if (qty < 1) return removeItem(productId)
    const item = cart[productId]
    if (!item) return
    save({ ...cart, [productId]: { ...item, quantity: qty } })
  }

  const clearCart = () => {
    save({})
    setPromo(null)
    localStorage.removeItem('cart')
  }

  const isPinned = (item) => pinnedCatId !== null && item.category_id === pinnedCatId

  // Для товаров из закрепа глобальная скидка не применяется
  const effectiveDiscount = (item) =>
    isPinned(item) ? (item.discount_percent || 0) : Math.max(item.discount_percent || 0, globalDiscount)

  // Есть ли в корзине хоть один товар из закрепа
  const hasPinnedItems = Object.values(cart).some(isPinned)

  // Сумма без каких-либо скидок
  const baseTotal = Object.values(cart).reduce((sum, item) =>
    sum + item.price * (item.quantity || 1), 0)

  // Сумма после скидки на товары (глобальная / per-product)
  const total = Object.values(cart).reduce((sum, item) => {
    const disc = effectiveDiscount(item)
    return sum + item.price * (1 - disc / 100) * (item.quantity || 1)
  }, 0)

  // Итог после промокода (промокод не применяется если есть товары из закрепа)
  const finalTotal = (promo && !hasPinnedItems)
    ? Math.round(total * (1 - promo.discount_percent / 100) * 100) / 100
    : Math.round(total * 100) / 100

  const count = Object.values(cart).reduce((sum, item) => sum + (item.quantity || 1), 0)

  return (
    <CartContext.Provider value={{ cart, promo, setPromo, addItem, addClearanceItem, removeItem, setQty, clearCart, baseTotal, total, finalTotal, count, globalDiscount, effectiveDiscount, hasPinnedItems }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
