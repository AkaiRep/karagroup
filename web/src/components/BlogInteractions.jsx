'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import TelegramLoginButton from '@/components/TelegramLoginButton'

export default function BlogInteractions({ slug }) {
  const { user } = useAuth()
  const [social, setSocial] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const load = () => api.getBlogSocial(slug).then(setSocial).catch(() => {})

  useEffect(() => {
    // increment view once
    api.incrementView(slug).catch(() => {})
    load()
  }, [slug])

  // reload social when user logs in
  useEffect(() => {
    if (user) load()
  }, [user])

  const handleLike = async () => {
    if (!user) return
    const res = await api.toggleLike(slug)
    setSocial(s => ({ ...s, likes: res.likes, liked_by_me: res.liked }))
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      await api.addComment(slug, commentText.trim())
      setCommentText('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 4000)
    } catch {}
    finally { setSubmitting(false) }
  }

  if (!social) return null

  return (
    <div className="mt-12 border-t border-white/8 pt-8 space-y-8">
      {/* Stats row */}
      <div className="flex items-center gap-5 text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          {social.views}
        </span>
        <button
          onClick={handleLike}
          disabled={!user}
          className={`flex items-center gap-1.5 transition-colors ${social.liked_by_me ? 'text-red-400' : 'hover:text-red-400'} ${!user ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <svg className="w-4 h-4" fill={social.liked_by_me ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          {social.likes}
        </button>
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          {social.comments.length}
        </span>
      </div>

      {/* Comments */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-4">Комментарии</h3>

        {social.comments.length > 0 ? (
          <div className="space-y-4 mb-6">
            {social.comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 text-sm font-medium text-green-400">
                  {(c.author_name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-300">{c.author_name}</span>
                    <span className="text-xs text-slate-600">
                      {new Date(c.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 mb-6">Пока нет комментариев. Будьте первым!</p>
        )}

        {/* Comment form */}
        {user ? (
          submitted ? (
            <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              Комментарий отправлен на модерацию — появится после проверки.
            </div>
          ) : (
            <form onSubmit={handleComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Написать комментарий..."
                rows={3}
                className="w-full bg-[#111318] border border-white/8 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-green-500/40 resize-none transition-colors"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Комментарий как: <span className="text-slate-400">{user.username}</span></span>
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {submitting ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          )
        ) : (
          <div className="flex items-center gap-4 bg-[#111318] border border-white/8 rounded-xl p-4">
            <p className="text-sm text-slate-400 flex-1">Войдите через Telegram чтобы оставить комментарий или поставить лайк</p>
            <TelegramLoginButton />
          </div>
        )}
      </div>
    </div>
  )
}
