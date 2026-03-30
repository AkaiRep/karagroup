'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import ru from '@/locales/ru.json'
import en from '@/locales/en.json'

const LOCALES = { ru, en }
export const AVAILABLE_LOCALES = [
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
]

const LocaleContext = createContext(null)

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('ru')

  useEffect(() => {
    const saved = localStorage.getItem('locale')
    if (saved && LOCALES[saved]) {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  const setLocale = (l) => {
    if (!LOCALES[l]) return
    setLocaleState(l)
    localStorage.setItem('locale', l)
    document.documentElement.lang = l
  }

  const t = (key) => {
    const parts = key.split('.')
    let val = LOCALES[locale]
    for (const part of parts) {
      val = val?.[part]
    }
    return val ?? key
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)
