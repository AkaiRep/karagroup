'use client'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function TelegramLoginButton({ onSuccess }) {
  const ref = useRef(null)
  const { loginWithTelegram } = useAuth()

  useEffect(() => {
    if (!ref.current) return

    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME
    if (!botUsername) return

    window.__tgAuthCallback = async (tgData) => {
      try {
        await loginWithTelegram(tgData)
        onSuccess?.()
      } catch (e) {
        console.error('Telegram auth failed:', e?.response?.data || e.message)
      }
    }

    const script = document.createElement('script')
    script.src = '/tg-widget/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', '__tgAuthCallback(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true

    ref.current.innerHTML = ''
    ref.current.appendChild(script)

    return () => {
      delete window.__tgAuthCallback
    }
  }, [])

  return (
    <div className="relative inline-block">
      {/* Кастомная кнопка — видимая */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-[#1e2130] border border-white/10 text-slate-300 text-sm font-medium rounded-xl select-none pointer-events-none">
        <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
        </svg>
        Войти через Telegram
      </div>
      {/* Оригинальный виджет — поверх, прозрачный, перехватывает клики */}
      <div ref={ref} className="absolute inset-0 z-10 opacity-0 overflow-hidden rounded-xl" />
    </div>
  )
}
