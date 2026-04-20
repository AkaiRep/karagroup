import { useEffect, useState } from 'react'
import { getApplications, updateApplication, deleteApplication } from '../api/index'

const STATUS_LABELS = {
  new: { label: 'Новая', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  reviewed: { label: 'Просмотрена', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  accepted: { label: 'Принята', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  rejected: { label: 'Отклонена', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtBirth(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}.${m}.${y}`
}

export default function Applications() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const load = () =>
    getApplications()
      .then(setItems)
      .catch(() => {})

  useEffect(() => {
    load()
  }, [])

  const open = (item) => {
    setSelected(item)
    setNotes(item.notes || '')
  }

  const close = () => {
    setSelected(null)
    setNotes('')
  }

  const save = async (status) => {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await updateApplication(selected.id, { status, notes })
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      setSelected(updated)
    } catch {}
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Удалить заявку?')) return
    try {
      await deleteApplication(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (selected?.id === id) close()
    } catch {}
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Заявки качеров</h1>
          <p className="text-slate-500 text-sm mt-0.5">Входящие анкеты с сайта</p>
        </div>
        <button onClick={load} className="text-sm text-slate-400 hover:text-white transition-colors">
          Обновить
        </button>
      </div>

      {/* Фильтр */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['all', 'Все'], ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v.label])].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
              filter === key
                ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                : 'text-slate-400 border-white/5 hover:border-white/15 hover:text-white'
            }`}
          >
            {label}
            {key !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {items.filter((i) => i.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">Заявок нет</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const st = STATUS_LABELS[item.status] || STATUS_LABELS.new
            return (
              <div
                key={item.id}
                onClick={() => open(item)}
                className="bg-surface border border-border/50 hover:border-white/15 rounded-xl px-5 py-4 cursor-pointer transition-colors flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.full_name}</div>
                  <div className="text-sm text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                    <span>@{item.telegram_username}</span>
                    <span>{item.phone}</span>
                    <span>{fmtDate(item.created_at)}</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${st.color}`}>
                  {st.label}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(item.id) }}
                  className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Модал */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={close}>
          <div
            className="bg-surface border border-border/50 rounded-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{selected.full_name}</h2>
              <button onClick={close} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Дата рождения" value={fmtBirth(selected.birth_date)} />
              <Row label="Телефон" value={selected.phone} />
              <Row label="Telegram" value={`@${selected.telegram_username}`} />
              <Row label="Согласие на данные" value={selected.consent_data ? '✅ Да' : '❌ Нет'} />
              <Row label="Согласие на документы" value={selected.consent_documents ? '✅ Да' : '❌ Нет'} />
              <Row label="Подана" value={fmtDate(selected.created_at)} />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Заметки</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Комментарий по заявке..."
                className="w-full bg-base border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/25 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
                <button
                  key={key}
                  disabled={saving || selected.status === key}
                  onClick={() => save(key)}
                  className={`py-2 rounded-lg text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected.status === key ? color : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => save(selected.status)}
              disabled={saving}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Сохранение...' : 'Сохранить заметки'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 w-44 flex-shrink-0">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}
