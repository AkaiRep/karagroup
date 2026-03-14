'use client'
import { useEffect, useState } from 'react'
import { BASE } from '@/lib/api'

export default function DevBanner() {
  const [enabled, setEnabled] = useState(false)
  const [text, setText] = useState('Сайт находится в разработке — возможны временные неполадки')

  useEffect(() => {
    fetch(`${BASE}/site-settings/`)
      .then(r => r.json())
      .then(data => {
        setEnabled(data.dev_banner_enabled === 'true')
        if (data.dev_banner_text) setText(data.dev_banner_text)
      })
      .catch(() => {})
  }, [])

  if (!enabled) return null

  return (
    <div className="relative w-full bg-amber-500/10 border-b border-amber-500/30 overflow-hidden py-2">
      {/* Pulse dot */}
      <span className="absolute left-4 top-1/2 -translate-y-1/2 flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
      </span>

      {/* Scrolling text */}
      <div className="overflow-hidden pl-10">
        <p className="animate-marquee whitespace-nowrap text-amber-300 text-sm font-medium">
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </p>
      </div>
    </div>
  )
}
