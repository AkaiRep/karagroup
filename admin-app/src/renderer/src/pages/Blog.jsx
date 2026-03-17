import { useEffect, useState } from 'react'
import { getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, getBlogPendingComments, approveBlogComment, deleteBlogComment } from '../api'
import RichEditor from '../components/RichEditor'

const EMPTY = { title: '', slug: '', excerpt: '', content: '', cover_image_url: '', is_published: false }

const TRANSLIT = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}

function slugify(str) {
  return str
    .toLowerCase()
    .split('').map(c => TRANSLIT[c] ?? c).join('')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Blog() {
  const [tab, setTab] = useState('posts') // 'posts' | 'comments'

  // Posts state
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | post object
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [slugManual, setSlugManual] = useState(false)

  // Comments state
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBlogPosts()
      setPosts(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setError(e?.response?.data?.detail || e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    setCommentsLoading(true)
    setCommentsError(null)
    try {
      const data = await getBlogPendingComments()
      setComments(Array.isArray(data) ? data : [])
    } catch (e) {
      setCommentsError(e?.response?.data?.detail || e?.message || 'Ошибка загрузки')
    } finally {
      setCommentsLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'comments') loadComments() }, [tab])

  const openNew = () => { setForm(EMPTY); setSlugManual(false); setEditing('new') }
  const openEdit = (post) => {
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content,
      cover_image_url: post.cover_image_url || '',
      is_published: post.is_published,
    })
    setSlugManual(true)
    setEditing(post)
  }
  const close = () => setEditing(null)

  const setTitle = (val) => {
    setForm(f => ({ ...f, title: val, ...(!slugManual ? { slug: slugify(val) } : {}) }))
  }

  const save = async () => {
    if (!form.title || !form.slug || !form.content) return
    setSaving(true)
    try {
      if (editing === 'new') {
        await createBlogPost(form)
      } else {
        await updateBlogPost(editing.id, form)
      }
      load(); close()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Удалить статью?')) return
    await deleteBlogPost(id); load()
  }

  const togglePublish = async (post) => {
    await updateBlogPost(post.id, { is_published: !post.is_published }); load()
  }

  const handleApprove = async (id) => {
    try {
      await approveBlogComment(id)
      setComments(cs => cs.filter(c => c.id !== id))
    } catch (e) {
      alert(e?.response?.data?.detail || 'Ошибка')
    }
  }

  const handleDeleteComment = async (id) => {
    if (!confirm('Удалить комментарий?')) return
    try {
      await deleteBlogComment(id)
      setComments(cs => cs.filter(c => c.id !== id))
    } catch (e) {
      alert(e?.response?.data?.detail || 'Ошибка')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Блог</h1>
        {tab === 'posts' && (
          <button
            onClick={openNew}
            className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Новая статья
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-border/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('posts')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'posts' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Статьи
        </button>
        <button
          onClick={() => setTab('comments')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'comments' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Комментарии
        </button>
      </div>

      {/* Posts tab */}
      {tab === 'posts' && (
        <>
          {loading && <div className="text-slate-400">Загрузка...</div>}
          {error && (
            <div className="p-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-4">{error}</div>
              <button onClick={load} className="text-sm text-slate-400 hover:text-white transition-colors">↩ Попробовать снова</button>
            </div>
          )}
          {!loading && !error && (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post.id} className="bg-surface border border-border/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${post.is_published ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                          {post.is_published ? 'Опубликовано' : 'Черновик'}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(post.created_at)}</span>
                      </div>
                      <p className="font-medium text-white mb-1">{post.title}</p>
                      <p className="text-xs text-slate-500 font-mono">/blog/{post.slug}</p>
                      {post.excerpt && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{post.excerpt}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => togglePublish(post)} className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${post.is_published ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10'}`}>
                        {post.is_published ? 'Снять' : 'Опубликовать'}
                      </button>
                      <button onClick={() => openEdit(post)} className="text-xs px-2 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors">Изменить</button>
                      <button onClick={() => remove(post.id)} className="text-xs px-2 py-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">×</button>
                    </div>
                  </div>
                </div>
              ))}
              {posts.length === 0 && <div className="text-slate-500 text-sm text-center py-12">Статей пока нет</div>}
            </div>
          )}
        </>
      )}

      {/* Comments tab */}
      {tab === 'comments' && (
        <>
          {commentsLoading && <div className="text-slate-400">Загрузка...</div>}
          {commentsError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-4">{commentsError}</div>
          )}
          {!commentsLoading && !commentsError && (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="bg-surface border border-border/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-300">{c.author_name}</span>
                        <span className="text-xs text-slate-500">{formatDate(c.created_at)}</span>
                        <span className="text-xs text-slate-600">→</span>
                        <span className="text-xs text-slate-500 truncate">{c.post_title}</span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{c.text}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(c.id)}
                        className="text-xs px-2 py-1.5 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                      >
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-xs px-2 py-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="text-slate-500 text-sm text-center py-12">Нет комментариев на модерации</div>
              )}
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-surface border border-border/50 rounded-2xl p-6 w-full max-w-2xl my-8">
            <h2 className="text-lg font-semibold mb-5">{editing === 'new' ? 'Новая статья' : 'Редактировать статью'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Заголовок *</label>
                <input
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  value={form.title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Как работает буст в Valorant"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Slug (URL) *</label>
                <input
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  value={form.slug}
                  onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
                  placeholder="kak-rabotaet-boost-valorant"
                />
                <p className="text-xs text-slate-600 mt-1">karashop.ru/blog/{form.slug || '...'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Краткое описание</label>
                <textarea
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500 resize-none"
                  rows={2}
                  value={form.excerpt}
                  onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                  placeholder="Краткое описание для карточки статьи и мета-тегов"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Текст статьи *</label>
                <RichEditor
                  key={editing === 'new' ? 'new' : editing?.id}
                  value={form.content}
                  onChange={html => setForm(f => ({ ...f, content: html }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">URL обложки</label>
                <input
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  value={form.cover_image_url}
                  onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-500"
                  checked={form.is_published}
                  onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
                />
                <span className="text-sm text-slate-300">Опубликовать</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={close} className="flex-1 py-2 border border-border rounded-lg text-sm text-slate-400 hover:text-white transition-colors">Отмена</button>
              <button
                onClick={save}
                disabled={saving || !form.title || !form.slug}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
