import { useEffect, useRef, useState } from 'react'
import {
  getGlobalMessages, sendGlobalMessage,
  uploadGlobalImage, createGlobalChatWs, API_BASE,
} from '../api'
import { useAuthStore, useGlobalChatStore } from '../store'
import { playSound } from '../utils/sound'

async function fetchImageBlob(url) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE()}${url}`
  const res = await fetch(fullUrl)
  return res.blob()
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

async function copyImageToClipboard(url) {
  const blob = await fetchImageBlob(url)
  const pngBlob = await convertToPng(blob)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
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

const ROLE_BADGE = {
  admin: 'bg-brand-500/20 text-brand-400',
  worker: 'bg-slate-700 text-slate-400',
}
const ROLE_LABEL = { admin: 'Админ', worker: 'Качер' }

export default function GlobalChat() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const { user } = useAuthStore()
  const { markRead, setOpen } = useGlobalChatStore()

  useEffect(() => {
    setOpen(true)
    markRead()
    getGlobalMessages().then(setMessages).finally(() => setLoading(false))

    const ws = createGlobalChatWs()
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg])
      // no sound here — we're already in the chat
    }

    return () => {
      ws.close()
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const uploadFile = async (file) => {
    setUploading(true)
    try { await uploadGlobalImage(file) } catch {}
    finally { setUploading(false) }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setText('')
    try { await sendGlobalMessage(content) } catch { setText(content) }
  }

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await uploadFile(file)
  }

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
      if (msg.image_url) await copyImageToClipboard(msg.image_url)
      else await navigator.clipboard.writeText(msg.content)
      setCopiedId(msg.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold">Общий чат</h1>
          <div className="text-xs text-slate-500 mt-0.5">Все пользователи видят эти сообщения</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500">онлайн</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
        {loading && <div className="text-slate-500 text-sm text-center py-8">Загрузка...</div>}
        {!loading && messages.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-8">Сообщений пока нет. Начните общение!</div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1 ${isMe ? 'bg-brand-500/30 text-brand-400' : 'bg-slate-700 text-slate-300'}`}>
                {msg.sender?.username?.[0]?.toUpperCase() || '?'}
              </div>

              <div className={`max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Name + role */}
                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-medium text-slate-300">{msg.sender?.username}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ROLE_BADGE[msg.sender?.role] || ROLE_BADGE.worker}`}>
                    {ROLE_LABEL[msg.sender?.role] || msg.sender?.role}
                  </span>
                </div>

                {/* Bubble */}
                <div className={`rounded-2xl ${isMe ? 'rounded-tr-sm bg-brand-500 text-white' : 'rounded-tl-sm bg-[#1a1f2e] text-slate-200'} ${msg.image_url ? 'p-1.5' : 'px-4 py-2.5'}`}>
                  {msg.image_url ? (
                    <div className="relative group/img">
                      <img
                        src={msg.image_url.startsWith('http') ? msg.image_url : `${API_BASE()}${msg.image_url}`}
                        alt="img"
                        className="max-w-[280px] max-h-[280px] rounded-xl object-cover cursor-pointer"
                        onClick={() => window.open(`${API_BASE()}${msg.image_url}`, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                        <button onClick={() => handleCopy(msg)} className="bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded">
                          {copiedId === msg.id ? '✓' : 'Копировать'}
                        </button>
                        <button onClick={() => downloadImage(msg.image_url, `chat_${msg.id}.jpg`).catch(() => {})} className="bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded">
                          Скачать
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {/* Time + copy */}
                <div className={`flex items-center gap-2 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] text-slate-600">
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!msg.image_url && (
                    <button
                      onClick={() => handleCopy(msg)}
                      className="text-[10px] text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedId === msg.id ? '✓' : 'копировать'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
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
            className="flex-1 bg-[#1a1f2e] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            placeholder={uploading ? 'Загружаем...' : 'Сообщение для всех... (Ctrl+V для фото)'}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex-shrink-0 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Отправить
          </button>
        </div>
      </form>
    </div>
  )
}
