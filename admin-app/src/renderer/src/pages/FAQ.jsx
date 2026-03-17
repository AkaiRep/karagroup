import { useEffect, useState } from 'react'
import { getFAQ, createFAQ, updateFAQ, deleteFAQ } from '../api'

const EMPTY = { question: '', answer: '', order: 0, is_active: true }

export default function FAQPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | faq object
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getFAQ()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (item) => { setForm({ question: item.question, answer: item.answer, order: item.order, is_active: item.is_active }); setEditing(item) }
  const close = () => setEditing(null)

  const save = async () => {
    setSaving(true)
    try {
      if (editing === 'new') {
        await createFAQ(form)
      } else {
        await updateFAQ(editing.id, form)
      }
      load()
      close()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Удалить вопрос?')) return
    await deleteFAQ(id)
    load()
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">FAQ</h1>
        <button onClick={openNew} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm transition-colors">
          + Добавить вопрос
        </button>
      </div>

      {loading && <div className="text-slate-500">Загрузка...</div>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-surface border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500">#{item.order}</span>
                  {!item.is_active && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">скрыт</span>
                  )}
                </div>
                <p className="font-medium text-white mb-1">{item.question}</p>
                <p className="text-sm text-slate-400 line-clamp-2 whitespace-pre-line">{item.answer}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                  Изменить
                </button>
                <button onClick={() => remove(item.id)} className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors">
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-10">Вопросов пока нет</div>
        )}
      </div>

      {/* Modal */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-slate-700/50 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-5">{editing === 'new' ? 'Новый вопрос' : 'Редактировать вопрос'}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Вопрос</label>
                <input
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  value={form.question}
                  onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  placeholder="Как долго выполняется заказ?"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ответ</label>
                <textarea
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500 resize-none"
                  rows={5}
                  value={form.answer}
                  onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                  placeholder="Обычно заказ выполняется в течение..."
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Порядок (чем меньше — тем выше)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">Активен</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={close} className="flex-1 py-2 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">
                Отмена
              </button>
              <button onClick={save} disabled={saving || !form.question || !form.answer} className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-lg text-sm text-white transition-colors">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
