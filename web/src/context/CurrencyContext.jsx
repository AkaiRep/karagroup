'use client'
import { createContext, useContext, useState, useEffect } from 'react'

export const CURRENCIES = {
  RUB: { symbol: '₽', code: 'RUB', label: '₽ RUB' },
  USD: { symbol: '$', code: 'USD', label: '$ USD' },
  EUR: { symbol: '€', code: 'EUR', label: '€ EUR' },
}

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState('RUB')

  useEffect(() => {
    const saved = localStorage.getItem('currency')
    if (saved && CURRENCIES[saved]) setCurrencyState(saved)
  }, [])

  const setCurrency = (c) => {
    if (!CURRENCIES[c]) return
    setCurrencyState(c)
    localStorage.setItem('currency', c)
  }

  // Returns the base price of a product in the current currency
  const getProductPrice = (product) => {
    if (currency === 'USD' && product.price_usd != null) return product.price_usd
    if (currency === 'EUR' && product.price_eur != null) return product.price_eur
    return product.price
  }

  // Returns the currency that will actually be shown for this product
  const getProductCurrency = (product) => {
    if (currency === 'USD' && product.price_usd != null) return 'USD'
    if (currency === 'EUR' && product.price_eur != null) return 'EUR'
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
      currency,
      setCurrency,
      currencies: Object.values(CURRENCIES),
      getProductPrice,
      getProductCurrency,
      formatAmount,
      symbol: CURRENCIES[currency].symbol,
    }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
