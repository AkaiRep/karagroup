'use client'
import { useState, useEffect, useRef } from 'react'
import { BASE } from '@/lib/api'

function FAQItem({ item }) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(open ? contentRef.current.scrollHeight : 0)
    }
  }, [open])

  return (
    <div className={`bg-[#111318] border rounded-2xl overflow-hidden transition-colors duration-200 ${open ? 'border-green-500/30' : 'border-white/5'}`}>
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className={`font-medium transition-colors duration-200 ${open ? 'text-green-400' : 'text-white'}`}>
          {item.question}
        </span>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${open ? 'bg-green-500/20 rotate-180' : 'bg-white/5'}`}>
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <div
        style={{ height, transition: 'height 0.25s ease', overflow: 'hidden' }}
      >
        <div ref={contentRef} className="px-5 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
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
      </div>
    </div>
  )
}

export default function FAQPage() {
  const [items, setItems] = useState([])

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
        {items.map(item => <FAQItem key={item.id} item={item} />)}
      </div>
    </div>
  )
}
