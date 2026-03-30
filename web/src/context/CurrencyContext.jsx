'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

export const CURRENCIES = {
  RUB: { symbol: '₽', code: 'RUB', label: '₽ RUB' },
  USD: { symbol: '$', code: 'USD', label: '$ USD' },
  EUR: { symbol: '€', code: 'EUR', label: '€ EUR' },
}

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const { user } = useAuth()
  const [currency, setCurrencyState] = useState('RUB')

  // Workers and admins always see RUB
  const isStaff = user?.role === 'worker' || user?.role === 'admin'
  const activeCurrency = isStaff ? 'RUB' : currency

  useEffect(() => {
    const saved = localStorage.getItem('currency')
    if (saved && CURRENCIES[saved]) setCurrencyState(saved)
  }, [])

  const setCurrency = (c) => {
    if (!CURRENCIES[c] || isStaff) return
    setCurrencyState(c)
    localStorage.setItem('currency', c)
  }

  // Returns the base price of a product in the current currency
  const getProductPrice = (product) => {
    if (activeCurrency === 'USD' && product.price_usd != null) return product.price_usd
    if (activeCurrency === 'EUR' && product.price_eur != null) return product.price_eur
    return product.price
  }

  // Returns the currency that will actually be shown for this product
  const getProductCurrency = (product) => {
    if (activeCurrency === 'USD' && product.price_usd != null) return 'USD'
    if (activeCurrency === 'EUR' && product.price_eur != null) return 'EUR'
    return 'RUB'
  }

  // Formats an amount in the current currency
  const formatAmount = (amount, overrideCurrency) => {
    const cur = overrideCurrency || currency
    if (cur === 'RUB') return `${Math.round(amount).toLocaleString('ru-RU')} ₽`
    if (cur === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (cur === 'EUR') return `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return `${amount} ${CURRENCIES[cur]?.symbol || ''}`
  }

  return (
    <CurrencyContext.Provider value={{
      currency: activeCurrency,
      setCurrency,
      currencies: Object.values(CURRENCIES),
      getProductPrice,
      getProductCurrency,
      formatAmount,
      symbol: CURRENCIES[activeCurrency].symbol,
      isStaff,
    }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
