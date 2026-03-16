'use client'
import { useState, useEffect } from 'react'
import { BASE } from '@/lib/api'

export default function FAQPage() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(null)

  useEffect(() => {
    fetch(`${BASE}/faq/`)
      .then(r => r.json())
      .then(setItems)
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Частые вопросы</h1>
        <p className="text-slate-400">Ответы на популярные вопросы о наших услугах</p>
      </div>

      {items.length === 0 && (
        <p className="text-slate-500 text-center py-16">Вопросы скоро появятся</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-[#111318] border border-white/5 rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
              onClick={() => setOpen(open === item.id ? null : item.id)}
            >
              <span className="font-medium text-white">{item.question}</span>
              <svg
                className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform ${open === item.id ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open === item.id && (
              <div className="px-5 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                {item.answer.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>
                    {line.split(/(https?:\/\/[^\s]+)/g).map((part, j) =>
                      /^https?:\/\//.test(part)
                        ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline underline-offset-2 break-all">{part}</a>
                        : part
                    )}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
