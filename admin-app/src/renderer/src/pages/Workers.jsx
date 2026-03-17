import { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser, getWorkersStats } from '../api'

function fmtDuration(seconds) {
  if (!seconds || seconds < 60) return '< 1 мин'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} мин`
  return `${h}ч ${m}м`
}

function fmtLastSeen(dateStr) {
  if (!dateStr) return 'никогда'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

export default function Workers() {
  const [workers, setWorkers] = useState([])
  const [stats, setStats] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', worker_percentage: 70, is_vip: false })
  const [hidePercentages, setHidePercentages] = useState(true)

  const loadStats = () =>
    getWorkersStats().then((list) => {
      const map = {}
      list.forEach((s) => { map[s.user_id] = s })
      setStats(map)
    }).catch(() => {})

  const load = () => {
    getUsers().then((users) => setWorkers(users.filter((u) => u.role === 'worker')))
    loadStats()
  }

  useEffect(() => {
    load()
    const interval = setInterval(loadStats, 15_000)
    return () => clearInterval(interval)
  }, [])

  const resetForm = () => {
    setForm({ username: '', password: '', worker_percentage: 70, is_vip: false })
    setEditId(null)
    setShowForm(false)
  }

  const handleEdit = (w) => {
    setForm({ username: w.username, password: '', worker_percentage: w.worker_percentage, is_vip: w.is_vip })
    setEditId(w.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editId) {
      const data = { worker_percentage: Number(form.worker_percentage), is_vip: form.is_vip }
      if (form.password) data.password = form.password
      await updateUser(editId, data)
    } else {
      await createUser({
        username: form.username,
        password: form.password,
        role: 'worker',
        worker_percentage: Number(form.worker_percentage),
        is_vip: form.is_vip,
      })
    }
    resetForm()
    load()
  }

  const handleToggle = async (w) => {
    await updateUser(w.id, { is_active: !w.is_active })
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить качера?')) return
    await deleteUser(id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Качеры</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHidePercentages(v => !v)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors font-medium ${hidePercentages ? 'bg-slate-700 border-border text-slate-300' : 'bg-green-500/15 border-green-500/30 text-green-400'}`}
          >
            {hidePercentages ? '🙈 Проценты скрыты' : '👁 Проценты видны'}
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Добавить качера
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-surface border border-border/50 rounded-xl p-5 mb-5">
          <div className="text-sm font-medium text-slate-300 mb-4">
            {editId ? 'Редактировать качера' : 'Новый качер'}
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Логин *</label>
              <input
                required={!editId}
                disabled={!!editId}
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 disabled:opacity-50"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Пароль {editId ? '(оставьте пустым — без изменений)' : '*'}
              </label>
              <input
                required={!editId}
                type="password"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Процент качера (%)</label>
              <input
                type="number" min="0" max="100" step="0.5"
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.worker_percentage}
                onChange={(e) => setForm({ ...form, worker_percentage: e.target.value })}
              />
            </div>
            <div className="col-span-3 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-500"
                  checked={form.is_vip}
                  onChange={(e) => setForm({ ...form, is_vip: e.target.checked })}
                />
                <span className="text-sm text-slate-300">VIP качер</span>
                <span className="text-xs text-slate-500">(вся прибыль = 100% − процент качера)</span>
              </label>
            </div>
            <div className="col-span-3 flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Отмена</button>
              <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase border-b border-border/50">
              <th className="text-left px-5 py-3">Качер</th>
              <th className="text-center px-5 py-3">VIP</th>
              <th className="text-right px-5 py-3">Процент</th>
              <th className="text-center px-5 py-3">Онлайн</th>
              <th className="text-right px-5 py-3">Время онлайн</th>
              <th className="text-right px-5 py-3">Заказов</th>
              <th className="text-right px-5 py-3">Ср. время заказа</th>
              <th className="text-center px-5 py-3">Аккаунт</th>
              <th className="text-right px-5 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => {
              const s = stats[w.id]
              const isOnline = s?.is_online ?? false
              return (
                <tr key={w.id} className="border-b border-border/30 hover:bg-slate-700/10">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <div>
                        <div className="font-medium text-white">{w.username}</div>
                        <div className="text-xs text-slate-500">
                          {isOnline ? 'в сети' : fmtLastSeen(s?.last_seen_at)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {w.is_vip ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 font-medium">VIP</span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {hidePercentages
                      ? <span className="text-slate-600 text-xs select-none">••••</span>
                      : <span className="text-green-400 font-medium">{w.worker_percentage}%</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-400/15 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                      {isOnline ? 'Онлайн' : 'Офлайн'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-300 text-xs">
                    {s ? fmtDuration(s.total_online_seconds) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s ? (
                      <div className="text-right">
                        <div className="text-white">{s.completed_orders} / {s.total_orders}</div>
                        <div className="text-xs text-slate-500">выполнено / взято</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s?.avg_order_seconds ? (
                      <div className="text-right">
                        <div className="text-white">{fmtDuration(s.avg_order_seconds)}</div>
                        <div className="text-xs text-slate-500">всего {fmtDuration(s.total_order_seconds)}</div>
                      </div>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${w.is_active ? 'bg-green-400/15 text-green-400' : 'bg-red-400/15 text-red-400'}`}>
                      {w.is_active ? 'Активен' : 'Отключён'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(w)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        Изменить
                      </button>
                      <button onClick={() => handleToggle(w)} className={`text-xs px-2 py-1 rounded transition-colors ${w.is_active ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10'}`}>
                        {w.is_active ? 'Отключить' : 'Включить'}
                      </button>
                      <button onClick={() => handleDelete(w.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-400/10 transition-colors">
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {workers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-slate-500">Качеров нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
