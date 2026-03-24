'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import TelegramLoginButton from '@/components/TelegramLoginButton'

export default function LoginPage() {
  const { user, loading, loginWithPassword, register } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'telegram'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.push(user.telegram_id ? '/' : '/profile')
    }
  }, [user, loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (tab === 'register') {
        await register(username.trim(), password)
      } else {
        await loginWithPassword(username.trim(), password)
      }
      // redirect handled by useEffect above
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail || (tab === 'register' ? 'Ошибка регистрации' : 'Неверный логин или пароль'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            {tab === 'register' ? 'Создать аккаунт' : tab === 'telegram' ? 'Войти через Telegram' : 'Вход в аккаунт'}
          </h1>
          <p className="text-slate-400 text-sm">
            {tab === 'register'
              ? 'После регистрации привяжите Telegram для заказов'
              : 'KaraShop — профессиональный буст'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#111318] rounded-xl p-1 mb-6 gap-1">
          <button
            onClick={() => { setTab('login'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'login' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Логин
          </button>
          <button
            onClick={() => { setTab('register'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'register' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Регистрация
          </button>
          <button
            onClick={() => { setTab('telegram'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${tab === 'telegram' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
            </svg>
            TG
          </button>
        </div>

        {tab === 'telegram' ? (
          <div className="bg-[#111318] border border-white/5 rounded-2xl p-6 text-center">
            <p className="text-slate-400 text-sm mb-6">Нажмите кнопку ниже для входа через Telegram</p>
            <div className="flex justify-center">
              <TelegramLoginButton onSuccess={() => router.push('/')} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#111318] border border-white/5 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Имя пользователя</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="username"
                autoComplete="username"
                required
                minLength={3}
                maxLength={64}
                className="w-full bg-[#0d0f15] border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••"
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                className="w-full bg-[#0d0f15] border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors"
            >
              {submitting ? '...' : tab === 'register' ? 'Создать аккаунт' : 'Войти'}
            </button>

            {tab === 'register' && (
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                После регистрации зайдите в профиль и привяжите Telegram — это нужно для получения уведомлений о заказе
              </p>
            )}
          </form>
        )}

        <p className="text-center text-sm text-slate-600 mt-6">
          <a href="/" className="hover:text-slate-400 transition-colors">← На главную</a>
        </p>
      </div>
    </div>
  )
}
