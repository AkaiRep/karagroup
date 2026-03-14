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

  const chunk = Array(8).fill(text).join('   ⚠️   ')

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        background: 'repeating-linear-gradient(45deg, #1c1400 0px, #1c1400 12px, #251c00 12px, #251c00 24px)',
        borderBottom: '1px solid rgba(251,191,36,0.35)',
      }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      <div className="relative flex items-center py-2 gap-3">
        {/* pulsing dot */}
        <div className="flex-shrink-0 pl-4 flex items-center">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
          </span>
        </div>

        {/* seamless marquee: two identical chunks, animate -50% */}
        <div className="overflow-hidden flex-1">
          <div className="dev-banner-marquee whitespace-nowrap text-amber-300 text-sm font-medium tracking-wide">
            <span>{chunk}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span>{chunk}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  )
}
