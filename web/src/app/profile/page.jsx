'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

export default function ProfilePage() {
  const { user, setUser, loading, logout } = useAuth()
  const router = useRouter()
  const [linkData, setLinkData] = useState(null) // {token, link, expires_in}
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linked, setLinked] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Start polling when linkData is set
  useEffect(() => {
    if (!linkData || user?.telegram_id) return
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.checkTelegramLink()
        if (res.linked) {
          clearInterval(pollRef.current)
          setLinked(true)
          setLinkData(null)
          // Refresh user data
          const updated = await api.getMe()
          setUser(updated)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [linkData])

  const generateLink = async () => {
    setGenerating(true)
    try {
      const res = await api.generateTelegramLinkToken()
      if (res.already_linked) {
        const updated = await api.getMe()
        setUser(updated)
      } else {
        setLinkData(res)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const copyLink = () => {
    if (!linkData?.link) return
    navigator.clipboard.writeText(linkData.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !user) return null

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'karashipikbot'

  return (
    <div className="min-h-screen bg-[#07080d] pt-20 px-4 pb-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Профиль</h1>

        {/* User info card */}
        <div className="bg-[#111318] border border-white/5 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center text-green-400 font-bold text-lg">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{user.username}</div>
              <div className="text-xs text-slate-500">Аккаунт клиента</div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-t border-white/5">
              <span className="text-slate-400">Telegram</span>
              {user.telegram_id ? (
                <span className="text-green-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  {user.telegram_username ? `@${user.telegram_username}` : 'Привязан'}
                </span>
              ) : (
                <span className="text-yellow-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  Не привязан
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Telegram linking */}
        {!user.telegram_id && !linked && (
          <div className="bg-[#111318] border border-yellow-500/20 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-yellow-400 mb-1">Привяжите Telegram</h2>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Без привязки вы не сможете оформлять заказы и получать уведомления о статусах.
            </p>

            {!linkData ? (
              <button
                onClick={generateLink}
                disabled={generating}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors text-sm"
              >
                {generating ? 'Генерирую ссылку...' : 'Получить ссылку для привязки'}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Нажмите кнопку ниже — откроется бот, нажмите <b>Start</b>:
                </p>
                <a
                  href={linkData.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#229ED9] hover:bg-[#1a8fc7] text-white rounded-xl font-semibold transition-colors text-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
                  </svg>
                  Открыть @{botUsername}
                </a>

                <button
                  onClick={copyLink}
                  className="w-full py-2.5 bg-[#0d0f15] border border-white/10 hover:border-white/20 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? '✓ Скопировано' : 'Скопировать ссылку'}
                </button>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  Ожидаю привязку...
                </div>

                <p className="text-xs text-slate-600 text-center">
                  Ссылка действительна 15 минут.{' '}
                  <button onClick={generateLink} className="underline hover:text-slate-400 transition-colors">
                    Обновить
                  </button>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {(linked || user.telegram_id) && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-green-400">Telegram привязан</div>
                <div className="text-sm text-slate-400">
                  {user.telegram_username ? `@${user.telegram_username}` : 'Аккаунт подключён'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <a
            href="/orders"
            className="flex items-center justify-between w-full px-5 py-3.5 bg-[#111318] border border-white/5 hover:border-white/10 rounded-xl transition-colors text-sm"
          >
            <span className="text-slate-300">Мои заказы</span>
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <button
            onClick={() => { logout(); router.push('/') }}
            className="w-full px-5 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-colors text-left"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  )
}
