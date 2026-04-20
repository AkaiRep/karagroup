'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ApplyPage() {
  const [form, setForm] = useState({
    full_name: '',
    birth_date: '',
    phone: '',
    telegram_username: '',
    consent_data: false,
    consent_documents: false,
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.consent_data || !form.consent_documents) {
      setError('Необходимо дать оба согласия для отправки заявки.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/applications/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Ошибка отправки')
      }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Произошла ошибка. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-3">Заявка отправлена!</h1>
        <p className="text-slate-400">
          Мы рассмотрим вашу заявку и свяжемся с вами в Telegram в ближайшее время.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Стать качером</h1>
        <p className="text-slate-400">
          Заполните анкету — мы свяжемся с вами в Telegram после рассмотрения.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ФИО */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            ФИО <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Иванов Иван Иванович"
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* Дата рождения */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Дата рождения <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            required
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
            className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* Телефон */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Номер телефона <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            required
            placeholder="+7 900 000 00 00"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* Telegram */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Telegram <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
            <input
              type="text"
              required
              placeholder="username"
              value={form.telegram_username}
              onChange={(e) => set('telegram_username', e.target.value.replace(/^@/, ''))}
              className="w-full bg-[#111318] border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>
        </div>

        {/* Согласия */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.consent_data}
              onChange={(e) => set('consent_data', e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-green-500"
            />
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Я даю согласие на обработку моих персональных данных в соответствии с Федеральным законом №152-ФЗ «О персональных данных».
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.consent_documents}
              onChange={(e) => set('consent_documents', e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-green-500"
            />
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Я согласен(-на) предоставить документы, удостоверяющие личность, по запросу администрации.
            </span>
          </label>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-3 transition-colors"
        >
          {loading ? 'Отправка...' : 'Отправить заявку'}
        </button>
      </form>
    </div>
  )
}
