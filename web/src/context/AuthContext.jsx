'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
      return
    }

    // Auto-login if opened as Telegram Mini App
    const twa = typeof window !== 'undefined' && window.Telegram?.WebApp
    const initData = twa?.initData
    if (initData) {
      twa.ready()
      twa.expand()
      api.telegramWebAppAuth(initData)
        .then(res => {
          localStorage.setItem('token', res.access_token)
          setUser(res.user)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const loginWithTelegram = async (tgData) => {
    const res = await api.telegramAuth(tgData)
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
    return res.user
  }

  const loginWithPassword = async (username, password) => {
    const res = await api.loginWithPassword(username, password)
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
    return res.user
  }

  const register = async (username, password) => {
    const res = await api.register(username, password)
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
    return res.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loginWithTelegram, loginWithPassword, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
