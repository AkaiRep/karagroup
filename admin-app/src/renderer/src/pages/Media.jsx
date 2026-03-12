import { useEffect, useState } from 'react'
import {
  getMedia, createMedia, updateMedia, deleteMedia,
  createPromoCode, updatePromoCode, deletePromoCode,
} from '../api'

function fmt(n) {
  return n == null ? '—' : `${Number(n).toFixed(0)} ₽`
}

export default function Media() {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMediaForm, setShowMediaForm] = useState(false)
  const [mediaForm, setMediaForm] = useState({ name: '' })
  const [editMediaId, setEditMediaId] = useState(null)

  // Promo code form state per media id
  const [promoForms, setPromoForms] = useState({})   // mediaId → {open, code, discount_percent, media_percent, editId}

  const load = () =>
    getMedia().then(setMedia).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const resetMediaForm = () => {
    setMediaForm({ name: '' })
    setEditMediaId(null)
    setShowMediaForm(false)
  }

  const handleMediaSubmit = async (e) => {
    e.preventDefault()
    if (editMediaId) await updateMedia(editMediaId, { name: mediaForm.name })
    else await createMedia({ name: mediaForm.name })
    resetMediaForm()
    load()
  }

  const handleMediaEdit = (m) => {
    setMediaForm({ name: m.name })
    setEditMediaId(m.id)
    setShowMediaForm(true)
  }

  const handleMediaToggle = async (m) => {
    await updateMedia(m.id, { is_active: !m.is_active })
    load()
  }

  const handleMediaDelete = async (id) => {
    if (!confirm('Удалить медиа и все его промокоды?')) return
    await deleteMedia(id)
    load()
  }

  const openPromoForm = (mediaId, promo = null) => {
    setPromoForms((prev) => ({
      ...prev,
      [mediaId]: {
        open: true,
        code: promo?.code || '',
        discount_percent: promo?.discount_percent ?? 0,
        media_percent: promo?.media_percent ?? 0,
        editId: promo?.id || null,
      },
    }))
  }

  const closePromoForm = (mediaId) => {
    setPromoForms((prev) => ({ ...prev, [mediaId]: { ...prev[mediaId], open: false } }))
  }

  const setPromoField = (mediaId, field, value) => {
    setPromoForms((prev) => ({
      ...prev,
      [mediaId]: { ...prev[mediaId], [field]: value },
    }))
  }

  const handlePromoSubmit = async (e, mediaId) => {
    e.preventDefault()
    const f = promoForms[mediaId]
    const payload = {
      code: f.code,
      discount_percent: Number(f.discount_percent),
      media_percent: Number(f.media_percent),
    }
    if (f.editId) await updatePromoCode(f.editId, payload)
    else await createPromoCode(mediaId, payload)
    closePromoForm(mediaId)
    load()
  }

  const handlePromoDelete = async (promoId) => {
    if (!confirm('Удалить промокод?')) return
    await deletePromoCode(promoId)
    load()
  }

  const handlePromoToggle = async (promo) => {
    await updatePromoCode(promo.id, { is_active: !promo.is_active })
    load()
  }

  const totalEarnings = (m) =>
    m.promo_codes.reduce((s, p) => s + (p.total_media_earnings || 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Медиа</h1>
        <button
          onClick={() => { resetMediaForm(); setShowMediaForm(true) }}
          className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Добавить медиа
        </button>
      </div>

      {showMediaForm && (
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5 mb-5">
          <div className="text-sm font-medium text-slate-300 mb-3">
            {editMediaId ? 'Редактировать медиа' : 'Новое медиа'}
          </div>
          <form onSubmit={handleMediaSubmit} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Имя / Никнейм</label>
              <input
                required
                className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={mediaForm.name}
                onChange={(e) => setMediaForm({ name: e.target.value })}
                placeholder="Блогер Вася"
              />
            </div>
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">
              {editMediaId ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" onClick={resetMediaForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Отмена
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Загрузка...</div>
      ) : media.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <div className="text-4xl mb-4">📺</div>
          <div>Медиа не добавлено</div>
        </div>
      ) : (
        <div className="space-y-4">
          {media.map((m) => {
            const pf = promoForms[m.id] || {}
            return (
              <div key={m.id} className={`bg-[#1a1f2e] border rounded-xl overflow-hidden ${m.is_active ? 'border-slate-700/50' : 'border-slate-700/20 opacity-60'}`}>
                {/* Media header */}
                <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-700/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-base">{m.name}</span>
                      {!m.is_active && <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-500">Отключён</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {m.promo_codes.length} промокод{m.promo_codes.length === 1 ? '' : m.promo_codes.length < 5 ? 'а' : 'ов'} ·
                      заработано: <span className="text-purple-400 font-medium">{fmt(totalEarnings(m))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPromoForm(m.id)} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 transition-colors">
                      + Промокод
                    </button>
                    <button onClick={() => handleMediaEdit(m)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                      Изменить
                    </button>
                    <button onClick={() => handleMediaToggle(m)} className={`text-xs px-2 py-1 rounded transition-colors ${m.is_active ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10'}`}>
                      {m.is_active ? 'Отключить' : 'Включить'}
                    </button>
                    <button onClick={() => handleMediaDelete(m.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-400/10 transition-colors">
                      ×
                    </button>
                  </div>
                </div>

                {/* Promo code form */}
                {pf.open && (
                  <div className="px-5 py-4 bg-[#0f1117] border-b border-slate-700/30">
                    <div className="text-xs text-slate-400 mb-3">{pf.editId ? 'Редактировать промокод' : 'Новый промокод'}</div>
                    <form onSubmit={(e) => handlePromoSubmit(e, m.id)} className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Промокод *</label>
                        <input
                          required
                          disabled={!!pf.editId}
                          className="bg-[#1a1f2e] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 uppercase w-36 disabled:opacity-50"
                          value={pf.code}
                          onChange={(e) => setPromoField(m.id, 'code', e.target.value.toUpperCase())}
                          placeholder="VASYA10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Скидка клиенту (%)</label>
                        <input
                          type="number" min="0" max="100" step="0.5"
                          className="bg-[#1a1f2e] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 w-28"
                          value={pf.discount_percent}
                          onChange={(e) => setPromoField(m.id, 'discount_percent', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">% медиа с заказа</label>
                        <input
                          type="number" min="0" max="100" step="0.5"
                          className="bg-[#1a1f2e] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 w-28"
                          value={pf.media_percent}
                          onChange={(e) => setPromoField(m.id, 'media_percent', e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors">
                          {pf.editId ? 'Сохранить' : 'Создать'}
                        </button>
                        <button type="button" onClick={() => closePromoForm(m.id)} className="text-sm text-slate-400 hover:text-white px-3 py-1.5 transition-colors">
                          Отмена
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Promo codes table */}
                {m.promo_codes.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs uppercase border-b border-slate-700/30">
                        <th className="text-left px-5 py-2">Промокод</th>
                        <th className="text-center px-4 py-2">Скидка</th>
                        <th className="text-center px-4 py-2">% медиа</th>
                        <th className="text-center px-4 py-2">Заказов</th>
                        <th className="text-right px-4 py-2">Заработано</th>
                        <th className="text-center px-4 py-2">Статус</th>
                        <th className="text-right px-4 py-2">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.promo_codes.map((p) => (
                        <tr key={p.id} className={`border-b border-slate-700/20 hover:bg-slate-700/10 ${!p.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-5 py-2.5">
                            <span className="font-mono text-brand-400 font-semibold tracking-wider">{p.code}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center text-green-400">{p.discount_percent}%</td>
                          <td className="px-4 py-2.5 text-center text-purple-400">{p.media_percent}%</td>
                          <td className="px-4 py-2.5 text-center text-slate-400">{p.order_count}</td>
                          <td className="px-4 py-2.5 text-right text-purple-300 font-medium">{fmt(p.total_media_earnings)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-400/15 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                              {p.is_active ? 'Активен' : 'Отключён'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openPromoForm(m.id, p)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                                Изменить
                              </button>
                              <button onClick={() => handlePromoToggle(p)} className={`text-xs px-2 py-1 rounded transition-colors ${p.is_active ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10'}`}>
                                {p.is_active ? 'Выкл' : 'Вкл'}
                              </button>
                              <button onClick={() => handlePromoDelete(p.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-400/10 transition-colors">
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-4 text-xs text-slate-600">Промокодов нет — нажмите «+ Промокод»</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
