import { useEffect, useRef, useState, useCallback } from 'react'
import { getMessages, sendMessage, uploadChatImage, createChatWs, markChatRead, API_BASE } from '../api'
import { useAuthStore, useChatStore } from '../store'
import { playSound } from '../utils/sound'

// ── Image helpers ─────────────────────────────────────────────────────────────
async function fetchImageBlob(url) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE()}${url}`
  const res = await fetch(fullUrl)
  return res.blob()
}

async function copyImageToClipboard(url) {
  const blob = await fetchImageBlob(url)
  const pngBlob = await convertToPng(blob)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
}

async function convertToPng(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('load failed')) }
    img.src = objectUrl
  })
}

async function downloadImage(url, filename) {
  const blob = await fetchImageBlob(url)
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename || 'image'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatPanel({ orderId, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const { user } = useAuthStore()
  const { markRead } = useChatStore()

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(orderId)
      setMessages(data)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    loadMessages()
    markRead(orderId)
    markChatRead(orderId).catch(() => {})

    const ws = createChatWs(orderId)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)

      if (data.type === 'read') {
        if (data.user_id !== user?.id) {
          const readAt = new Date(data.read_at)
          setMessages((prev) =>
            prev.map((m) =>
              m.sender_id === user?.id && new Date(m.created_at) <= readAt
                ? { ...m, is_read: true }
                : m
            )
          )
        }
        return
      }

      // regular message
      const msg = data
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev
        if (msg.sender_id !== user?.id) {
          playSound('message')
          markChatRead(orderId).catch(() => {})
        }
        return [...prev, msg]
      })
    }
    return () => ws.close()
  }, [orderId])


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setText('')
    try {
      await sendMessage(orderId, content)
    } catch {
      setText(content)
    }
  }

  const uploadFile = async (file) => {
    setUploading(true)
    try {
      await uploadChatImage(orderId, file)
    } catch {}
    finally { setUploading(false) }
  }

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await uploadFile(file)
  }

  // Ctrl+V paste from clipboard
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) await uploadFile(file)
        return
      }
    }
  }

  const handleCopy = async (msg) => {
    try {
      if (msg.image_url) {
        await copyImageToClipboard(msg.image_url)
      } else {
        await navigator.clipboard.writeText(msg.content)
      }
      setCopiedId(msg.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  return (
    <div className="flex flex-col h-full bg-surface border-l border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 flex-shrink-0">
        <div className="text-sm font-medium text-slate-300">Чат — Заказ #{orderId}</div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">
            ×
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && <div className="text-slate-500 text-sm text-center py-4">Загрузка...</div>}
        {!loading && messages.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-4">Сообщений нет</div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className="max-w-[80%]">
                {!isMe && (
                  <div className="text-xs text-slate-400 mb-0.5 px-1">
                    {msg.sender?.username || 'Unknown'}
                  </div>
                )}
                <div className={`rounded-xl ${isMe ? 'bg-brand-500 text-white' : 'bg-base text-slate-200'} ${msg.image_url ? 'p-1.5' : 'px-3 py-2'}`}>
                  {msg.image_url ? (
                    <ImageMessage
                      msg={msg}
                      isMe={isMe}
                      copied={copiedId === msg.id}
                      onCopy={() => handleCopy(msg)}
                      onDownload={() => downloadImage(msg.image_url, `chat_${msg.id}.jpg`).catch(() => {})}
                    />
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      <div className={`flex items-center justify-end gap-2 mt-1`}>
                        <button
                          onClick={() => handleCopy(msg)}
                          className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'text-white/60 hover:text-white' : 'text-slate-600 hover:text-slate-400'}`}
                        >
                          {copiedId === msg.id ? '✓' : 'копировать'}
                        </button>
                        <span className={`text-xs ${isMe ? 'text-white/50' : 'text-slate-600'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <span className={`text-xs leading-none ${msg.is_read ? 'text-blue-400' : 'text-white/30'}`} title={msg.is_read ? 'Прочитано' : 'Доставлено'}>
                            {msg.is_read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} onPaste={handlePaste} className="px-3 py-3 border-t border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Отправить изображение"
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors text-xl"
          >
            {uploading ? '⏳' : '🖼'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleImagePick}
          />
          <input
            className="flex-1 bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            placeholder={uploading ? 'Загружаем...' : 'Сообщение... (Ctrl+V для фото)'}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex-shrink-0 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            →
          </button>
        </div>
      </form>
    </div>
  )
}

function ImageMessage({ msg, isMe, copied, onCopy, onDownload }) {
  const fullUrl = msg.image_url.startsWith('http') ? msg.image_url : `${API_BASE()}${msg.image_url}`
  return (
    <div className="relative group/img">
      <img
        src={fullUrl}
        alt="chat image"
        className="max-w-[240px] max-h-[240px] rounded-lg object-cover cursor-pointer"
        onClick={() => window.open(fullUrl, '_blank')}
      />
      {/* Overlay controls */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
        <button
          onClick={onCopy}
          title="Копировать в буфер"
          className="bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded transition-colors"
        >
          {copied ? '✓ скопировано' : 'Копировать'}
        </button>
        <button
          onClick={onDownload}
          title="Скачать"
          className="bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded transition-colors"
        >
          Скачать
        </button>
      </div>
      <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'justify-end' : ''}`}>
        <span className={`text-xs ${isMe ? 'text-white/50' : 'text-slate-600'}`}>
          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isMe && (
          <span className={`text-xs leading-none ${msg.is_read ? 'text-blue-400' : 'text-white/30'}`} title={msg.is_read ? 'Прочитано' : 'Доставлено'}>
            {msg.is_read ? '✓✓' : '✓'}
          </span>
        )}
      </div>
    </div>
  )
}
