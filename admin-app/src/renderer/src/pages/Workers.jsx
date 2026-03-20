import { useEffect, useRef, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser, getWorkersStats, fetchWorkerScreenshot, requestWorkerScreenshot, createScreenViewWs, createMicViewWs, fetchWorkerProcesses } from '../api'

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

function MicModal({ worker, onClose }) {
  const [listening, setListening] = useState(false)
  const wsRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceBufferRef = useRef(null)
  const audioRef = useRef(null)
  const mediaSourceRef = useRef(null)
  const queueRef = useRef([])
  const appendingRef = useRef(false)

  const appendNext = () => {
    const sb = sourceBufferRef.current
    if (!sb || sb.updating || appendingRef.current || queueRef.current.length === 0) return
    appendingRef.current = true
    const data = queueRef.current.shift()
    try { sb.appendBuffer(data) } catch { appendingRef.current = false }
  }

  const startListening = () => {
    const ms = new MediaSource()
    mediaSourceRef.current = ms
    const audio = audioRef.current
    audio.src = URL.createObjectURL(ms)

    ms.addEventListener('sourceopen', () => {
      try {
        const sb = ms.addSourceBuffer('audio/webm;codecs=opus')
        sourceBufferRef.current = sb
        sb.addEventListener('updateend', () => {
          appendingRef.current = false
          appendNext()
          if (audio.buffered.length > 0) {
            const end = audio.buffered.end(audio.buffered.length - 1)
            if (end - audio.currentTime > 1.5) audio.currentTime = end - 0.1
          }
        })
      } catch (e) { console.error('SourceBuffer error:', e) }
    })

    audio.play().catch(() => {})

    const ws = createMicViewWs(worker.id)
    ws.binaryType = 'arraybuffer'
    ws.onmessage = (e) => {
      queueRef.current.push(e.data)
      appendNext()
    }
    ws.onclose = () => setListening(false)
    wsRef.current = ws
    setListening(true)
  }

  const stopListening = () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.src = '' }
    sourceBufferRef.current = null
    queueRef.current = []
    appendingRef.current = false
    setListening(false)
  }

  useEffect(() => () => stopListening(), [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1d2e] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="font-semibold text-white">{worker.username} — микрофон</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all ${listening ? 'bg-red-500/20 ring-4 ring-red-500/40 animate-pulse' : 'bg-slate-700/50'}`}>
            🎙
          </div>
          <p className="text-sm text-slate-400">{listening ? 'Слушаем микрофон...' : 'Нажмите чтобы начать'}</p>
          <button
            onClick={listening ? stopListening : startListening}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${listening ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30' : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'}`}
          >
            {listening ? 'Остановить' : 'Слушать'}
          </button>
        </div>
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  )
}

function ProcessesModal({ worker, onClose }) {
  const [processes, setProcesses] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchWorkerProcesses(worker.id)
      setProcesses(data.processes || [])
      setUpdatedAt(data.updated_at ? new Date(data.updated_at) : null)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = processes.filter(p => p.toLowerCase().includes(search.toLowerCase()))
  const age = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 1000) : null
  const ageStr = age === null ? '' : age < 60 ? `${age}с назад` : `${Math.floor(age / 60)}м назад`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1d2e] border border-white/10 rounded-2xl p-5 w-[480px] max-h-[70vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-white">{worker.username} — процессы</div>
            {updatedAt && <div className="text-xs text-slate-500 mt-0.5">Обновлено: {ageStr} · {processes.length} процессов</div>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 border border-border text-slate-300 hover:text-white disabled:opacity-50 transition-colors">
              {loading ? '...' : 'Обновить'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск процесса..."
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 mb-3"
        />
        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.length === 0 && <div className="text-slate-500 text-sm text-center py-8">{loading ? 'Загрузка...' : 'Нет данных'}</div>}
          {filtered.map((p, i) => (
            <div key={i} className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-white/5 font-mono">{p}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScreenshotModal({ worker, onClose }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [capturedAt, setCapturedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [live, setLive] = useState(false)
  const prevUrlRef = useRef(null)
  const pollRef = useRef(null)
  const wsRef = useRef(null)
  const liveImgRef = useRef(null)

  const loadShot = async () => {
    try {
      const res = await fetchWorkerScreenshot(worker.id)
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
      const url = URL.createObjectURL(res.data)
      prevUrlRef.current = url
      setImgUrl(url)
      const ts = res.headers['x-captured-at']
      setCapturedAt(ts ? new Date(Number(ts)) : new Date())
      return Number(ts) || 0
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true)
      return 0
    }
  }

  const handleRefresh = async () => {
    if (loading || waiting) return
    setWaiting(true)
    try {
      const tsBefore = capturedAt ? capturedAt.getTime() : 0
      await requestWorkerScreenshot(worker.id)
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        const ts = await loadShot()
        if (ts > tsBefore || attempts >= 5) {
          clearInterval(pollRef.current)
          setWaiting(false)
        }
      }, 2000)
    } catch {
      setWaiting(false)
    }
  }

  const stopLive = () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    setLive(false)
  }

  const startLive = () => {
    if (wsRef.current) return
    const ws = createScreenViewWs(worker.id)
    ws.binaryType = 'arraybuffer'
    ws.onmessage = (e) => {
      const blob = new Blob([e.data], { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      if (liveImgRef.current) {
        const old = liveImgRef.current.src
        liveImgRef.current.src = url
        if (old.startsWith('blob:')) URL.revokeObjectURL(old)
      }
      setCapturedAt(new Date())
    }
    ws.onclose = () => { wsRef.current = null; setLive(false) }
    wsRef.current = ws
    setLive(true)
  }

  const toggleLive = () => live ? stopLive() : startLive()

  useEffect(() => {
    setLoading(true)
    loadShot().finally(() => setLoading(false))
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
      stopLive()
    }
  }, [])

  const age = capturedAt ? Math.floor((Date.now() - capturedAt.getTime()) / 1000) : null
  const ageStr = age === null ? '' : age < 60 ? `${age}с назад` : age < 3600 ? `${Math.floor(age / 60)}м назад` : `${Math.floor(age / 3600)}ч назад`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1d2e] border border-white/10 rounded-2xl p-5 max-w-4xl w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-white">{worker.username} — экран</div>
            {capturedAt && <div className="text-xs text-slate-500 mt-0.5">{live ? 'Live' : 'Снято'}: {ageStr}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLive}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${live ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}
            >
              {live ? '⏹ Стоп' : '▶ Live ~10 FPS'}
            </button>
            {!live && (
              <button onClick={handleRefresh} disabled={loading || waiting} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 border border-border text-slate-300 hover:text-white transition-colors disabled:opacity-50">
                {waiting ? 'Ждём...' : loading ? '...' : 'Обновить'}
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">×</button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-black min-h-[200px] flex items-center justify-center">
          {notFound && !imgUrl && !live && <div className="text-slate-500 text-sm py-16">Скриншотов нет — нажмите «Обновить»</div>}
          {!notFound && !imgUrl && loading && <div className="text-slate-500 text-sm py-16">Загрузка...</div>}
          {/* Static screenshot */}
          {imgUrl && !live && <img src={imgUrl} alt="screenshot" className="w-full h-auto block" />}
          {/* Live stream */}
          <img ref={liveImgRef} alt="live" className={`w-full h-auto block ${live ? '' : 'hidden'}`} />
        </div>
      </div>
    </div>
  )
}

export default function Workers() {
  const [workers, setWorkers] = useState([])
  const [stats, setStats] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', worker_percentage: 70, is_vip: false })
  const [hidePercentages, setHidePercentages] = useState(true)
  const [screenshotWorker, setScreenshotWorker] = useState(null)
  const [micWorker, setMicWorker] = useState(null)
  const [processesWorker, setProcessesWorker] = useState(null)

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
    <>
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
                      <button onClick={() => setScreenshotWorker(w)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Экран">
                        📷
                      </button>
                      <button onClick={() => setMicWorker(w)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Микрофон">
                        🎙
                      </button>
                      <button onClick={() => setProcessesWorker(w)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Процессы">
                        ⚙
                      </button>
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

    {screenshotWorker && (
      <ScreenshotModal worker={screenshotWorker} onClose={() => setScreenshotWorker(null)} />
    )}
    {micWorker && (
      <MicModal worker={micWorker} onClose={() => setMicWorker(null)} />
    )}
    {processesWorker && (
      <ProcessesModal worker={processesWorker} onClose={() => setProcessesWorker(null)} />
    )}
    </>
  )
}
