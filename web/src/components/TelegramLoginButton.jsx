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
        console.error('Telegram auth failed', e)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
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

  return <div ref={ref} />
}
