import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { Mark } from '@tiptap/core'
import { useRef, useState, useEffect, useCallback } from 'react'
import { uploadBlogImage, getApiBase } from '../api'

// Inline quote mark — works on any selection like bold/italic
const InlineQuote = Mark.create({
  name: 'inlineQuote',
  parseHTML() { return [{ tag: 'span[data-quote]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-quote': '', class: 'inline-quote' }, 0]
  },
})

const Sep = () => <div className="w-px h-5 bg-border self-center mx-0.5 flex-shrink-0" />

function Btn({ active, onClick, title, children, small }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-1.5 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 flex items-center justify-center
        ${small ? 'min-w-[24px] h-6' : 'min-w-[26px] h-7'}
        ${active ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
    >
      {children}
    </button>
  )
}

// ── Link dialog ───────────────────────────────────────────────────────────────
function LinkDialog({ onConfirm, onClose, initial }) {
  const [url, setUrl] = useState(initial || '')
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  const submit = () => {
    onConfirm(url.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div className="bg-surface border border-border rounded-xl p-4 w-80 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        <p className="text-sm font-medium mb-3">Вставить ссылку</p>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          placeholder="https://..."
          className="w-full bg-[#0d0f14] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 mb-3"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-1.5 border border-border rounded-lg text-xs text-slate-400 hover:text-white transition-colors">Отмена</button>
          {initial && (
            <button onClick={() => { onConfirm(''); onClose() }} className="px-3 py-1.5 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/10 transition-colors">Удалить</button>
          )}
          <button onClick={submit} className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-600 rounded-lg text-xs text-white transition-colors">Применить</button>
        </div>
      </div>
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────
function ContextMenu({ editor, pos, onClose, onBlockquote }) {
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const do_ = (fn) => { fn(); onClose() }

  const items = [
    { label: 'Жирный', shortcut: 'B', active: editor.isActive('bold'), fn: () => editor.chain().focus().toggleBold().run() },
    { label: 'Курсив', shortcut: 'I', active: editor.isActive('italic'), fn: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Подчёркнутый', shortcut: 'U', active: editor.isActive('underline'), fn: () => editor.chain().focus().toggleUnderline().run() },
    { label: 'Зачёркнутый', active: editor.isActive('strike'), fn: () => editor.chain().focus().toggleStrike().run() },
    null,
    { label: 'Заголовок 1', active: editor.isActive('heading', { level: 1 }), fn: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Заголовок 2', active: editor.isActive('heading', { level: 2 }), fn: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Заголовок 3', active: editor.isActive('heading', { level: 3 }), fn: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    null,
    { label: 'Список', active: editor.isActive('bulletList'), fn: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Нумер. список', active: editor.isActive('orderedList'), fn: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Цитата', active: editor.isActive('inlineQuote'), fn: () => onBlockquote() },
  ]

  // Adjust position to stay in viewport
  const style = { position: 'fixed', top: pos.y, left: pos.x, zIndex: 300 }

  return (
    <div
      ref={ref}
      style={style}
      className="bg-surface border border-border rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden"
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="h-px bg-border/50 my-1" />
        ) : (
          <button
            key={item.label}
            onMouseDown={e => { e.preventDefault(); do_(item.fn) }}
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between gap-4 transition-colors
              ${item.active ? 'text-brand-400 bg-brand-500/10' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <span>{item.label}</span>
            {item.shortcut && <kbd className="text-xs text-slate-500 font-mono">Ctrl+{item.shortcut}</kbd>}
          </button>
        )
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RichEditor({ value, onChange }) {
  const fileRef = useRef()
  const [linkDialog, setLinkDialog] = useState(null) // null | { initial }
  const [ctxMenu, setCtxMenu] = useState(null)       // null | { x, y }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Начните писать статью...' }),
      InlineQuote,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  const toggleBlockquote = useCallback(() => {
    if (!editor) return
    editor.chain().focus().toggleMark('inlineQuote').run()
  }, [editor])

  const openLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href || ''
    setLinkDialog({ initial: prev })
  }, [editor])

  const applyLink = useCallback((url) => {
    if (!editor) return
    if (!url) { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
  }, [editor])

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { url } = await uploadBlogImage(file)
      const src = url.startsWith('/') ? `${getApiBase()}${url}` : url
      editor.chain().focus().setImage({ src }).insertContentAt(editor.state.selection.to + 1, { type: 'paragraph' }).run()
    } catch {
      alert('Ошибка загрузки изображения')
    }
    e.target.value = ''
  }

  const handleContextMenu = useCallback((e) => {
    if (!editor) return
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [editor])

  if (!editor) return null

  // Inline bubble toolbar buttons (compact)
  const BubbleBtn = ({ active, onClick, children, title }) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-1.5 py-1 rounded text-xs font-medium transition-colors min-w-[24px] h-6 flex items-center justify-center
        ${active ? 'bg-white text-black' : 'text-slate-300 hover:text-white hover:bg-white/20'}`}
    >
      {children}
    </button>
  )

  return (
    <div className="border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-base border-b border-border">
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирный (Ctrl+B)">
          <strong>B</strong>
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив (Ctrl+I)">
          <em>I</em>
        </Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Подчёркнутый">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Зачёркнутый">
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </Btn>

        <Sep />

        {[1, 2, 3].map(level => (
          <Btn key={level} active={editor.isActive('heading', { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()} title={`Заголовок ${level}`}>
            H{level}
          </Btn>
        ))}

        <Sep />

        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркированный список">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерованный список">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/>
            <path d="M3 6h1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 14h2l-2 2h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Btn>

        <Sep />

        <Btn active={editor.isActive('inlineQuote')} onClick={() => toggleBlockquote()} title="Цитата">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
          </svg>
        </Btn>
        <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline код">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
        </Btn>
        <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Блок кода">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.5"/>
          </svg>
        </Btn>
        <Btn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Горизонтальная линия">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="2" y1="12" x2="22" y2="12"/>
          </svg>
        </Btn>

        <Sep />

        <Btn active={editor.isActive('link')} onClick={openLink} title="Ссылка">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </Btn>
        <Btn active={false} onClick={() => fileRef.current?.click()} title="Загрузить изображение">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </Btn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

        <Sep />

        <Btn active={false} onClick={() => editor.chain().focus().undo().run()} title="Отменить (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
        </Btn>
        <Btn active={false} onClick={() => editor.chain().focus().redo().run()} title="Повторить (Ctrl+Y)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
          </svg>
        </Btn>
      </div>

      {/* Bubble menu — appears when text is selected */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top' }}
        className="flex items-center gap-0.5 bg-[#1a1d24] border border-border rounded-lg px-1.5 py-1 shadow-xl"
      >
        <BubbleBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирный">
          <strong>B</strong>
        </BubbleBtn>
        <BubbleBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">
          <em>I</em>
        </BubbleBtn>
        <BubbleBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Подчёркнутый">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </BubbleBtn>
        <BubbleBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Зачёркнутый">
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </BubbleBtn>
        <div className="w-px h-4 bg-border mx-0.5" />
        <BubbleBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</BubbleBtn>
        <BubbleBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</BubbleBtn>
        <div className="w-px h-4 bg-border mx-0.5" />
        <BubbleBtn active={editor.isActive('inlineQuote')} onClick={() => toggleBlockquote()} title="Цитата">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
          </svg>
        </BubbleBtn>
        <BubbleBtn active={editor.isActive('link')} onClick={openLink} title="Ссылка">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </BubbleBtn>
      </BubbleMenu>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="rich-editor"
        onContextMenu={handleContextMenu}
      />

      {/* Right-click context menu */}
      {ctxMenu && (
        <ContextMenu
          editor={editor}
          pos={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onBlockquote={() => { toggleBlockquote(); setCtxMenu(null) }}
        />
      )}

      {/* Link dialog */}
      {linkDialog && (
        <LinkDialog
          initial={linkDialog.initial}
          onConfirm={applyLink}
          onClose={() => setLinkDialog(null)}
        />
      )}
    </div>
  )
}
