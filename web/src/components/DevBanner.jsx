'use client'
import { useEffect, useState } from 'react'
import { BASE } from '@/lib/api'

const SEP = ' \u00a0\u00a0\u00a0⚠\u00a0\u00a0\u00a0 '

export default function DevBanner() {
  const [enabled, setEnabled] = useState(false)
  const [text, setText] = useState('Сайт находится в разработке — возможны временные неполадки')
  const [color, setColor] = useState('#fbbf24')

  useEffect(() => {
    fetch(`${BASE}/site-settings/`)
      .then(r => r.json())
      .then(data => {
        setEnabled(data.dev_banner_enabled === 'true')
        if (data.dev_banner_text) setText(data.dev_banner_text)
        if (data.dev_banner_color) setColor(data.dev_banner_color)
      })
      .catch(() => {})
  }, [])

  if (!enabled) return null

  const chunk = Array(10).fill(text).join(SEP)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        background: 'repeating-linear-gradient(45deg, #1c1400 0px, #1c1400 12px, #2d2200 12px, #2d2200 24px)',
        borderBottom: '1px solid rgba(251,191,36,0.4)',
        animation: 'devBannerGlow 1.4s ease-in-out infinite',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '7px 0', gap: 12 }}>

        {/* pulsing dot — inline styles only */}
        <div style={{ flexShrink: 0, paddingLeft: 16, display: 'flex', alignItems: 'center' }}>
          <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 0 0 ${color}b3`,
            animation: 'devBannerPulse 0.9s ease-in-out infinite',
          }} />
        </div>

        {/* seamless marquee */}
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            color: color,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.03em',
            animation: 'devBannerScroll 56s linear infinite, devBannerTextPulse 1.4s ease-in-out infinite',
          }}>
            <span>{chunk}</span>
            <span>{chunk}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
