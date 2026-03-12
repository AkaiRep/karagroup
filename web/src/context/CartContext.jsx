'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState({}) // { [productId]: { ...product, quantity: 1 } }
  const [promo, setPromo] = useState(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (saved) setCart(JSON.parse(saved))
    } catch {}
  }, [])

  const save = (newCart) => {
    setCart(newCart)
    localStorage.setItem('cart', JSON.stringify(newCart))
  }

  const addItem = (product) => {
    const existing = cart[product.id]
    save({ ...cart, [product.id]: { ...product, quantity: existing ? existing.quantity + 1 : 1 } })
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

  const total = Object.values(cart).reduce((sum, item) => {
    const disc = item.discount_percent || 0
    return sum + item.price * (1 - disc / 100) * (item.quantity || 1)
  }, 0)

  const finalTotal = promo
    ? Math.round(total * (1 - promo.discount_percent / 100) * 100) / 100
    : Math.round(total * 100) / 100

  const count = Object.values(cart).reduce((sum, item) => sum + (item.quantity || 1), 0)

  return (
    <CartContext.Provider value={{ cart, promo, setPromo, addItem, removeItem, setQty, clearCart, total, finalTotal, count }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
