'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState({}) // { [productId]: product }
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
    save({ ...cart, [product.id]: product })
  }

  const removeItem = (productId) => {
    const next = { ...cart }
    delete next[String(productId)]
    save(next)
    if (Object.keys(next).length === 0) setPromo(null)
  }

  const clearCart = () => {
    save({})
    setPromo(null)
    localStorage.removeItem('cart')
  }

  const total = Object.values(cart).reduce((sum, item) => {
    const disc = item.discount_percent || 0
    return sum + item.price * (1 - disc / 100)
  }, 0)

  const finalTotal = promo
    ? Math.round(total * (1 - promo.discount_percent / 100) * 100) / 100
    : Math.round(total * 100) / 100

  const count = Object.keys(cart).length

  return (
    <CartContext.Provider value={{ cart, promo, setPromo, addItem, removeItem, clearCart, total, finalTotal, count }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
