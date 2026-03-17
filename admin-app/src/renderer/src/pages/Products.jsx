import { useEffect, useRef, useState } from 'react'
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  getCategories, createCategory, updateCategory, deleteCategory,
  getGlobalDiscount, setGlobalDiscount,
  uploadProductImage, deleteProductImage, API_BASE,
} from '../api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null) // null=все, 'none'=без категории, id=фильтр

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', price: '', discount_percent: '0', category_id: '' })

  const [showCatForm, setShowCatForm] = useState(false)
  const [editCatId, setEditCatId] = useState(null)
  const [catName, setCatName] = useState('')
  const [catDescription, setCatDescription] = useState('')

  const [globalDiscount, setGlobalDiscountState] = useState(0)
  const [globalDiscountInput, setGlobalDiscountInput] = useState('0')
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [uploadingImageFor, setUploadingImageFor] = useState(null)
  const imageInputRef = useRef(null)
  const imageTargetId = useRef(null)

  const load = () =>
    Promise.all([getProducts(), getCategories(), getGlobalDiscount()]).then(([p, c, gd]) => {
      setProducts(p)
      setCategories(c)
      setGlobalDiscountState(gd.value)
      setGlobalDiscountInput(String(gd.value))
    })

  useEffect(() => { load() }, [])

  // ── Global discount ──────────────────────────────────────────────────────────

  const handleSaveGlobal = async (e) => {
    e.preventDefault()
    setSavingGlobal(true)
    try {
      const val = Math.min(100, Math.max(0, Number(globalDiscountInput)))
      await setGlobalDiscount(val)
      setGlobalDiscountState(val)
      setGlobalDiscountInput(String(val))
    } finally {
      setSavingGlobal(false)
    }
  }

  // ── Product CRUD ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', discount_percent: '0', category_id: '' })
    setEditId(null)
    setShowForm(false)
  }

  const handleEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', price: p.price, discount_percent: p.discount_percent ?? 0, category_id: p.category_id ?? '' })
    setEditId(p.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      discount_percent: Number(form.discount_percent) || 0,
      category_id: form.category_id !== '' ? Number(form.category_id) : null,
    }
    if (editId) {
      await updateProduct(editId, data)
    } else {
      await createProduct(data)
    }
    resetForm()
    load()
  }

  const handleToggle = async (p) => {
    await updateProduct(p.id, { is_active: !p.is_active })
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить услугу?')) return
    await deleteProduct(id)
    load()
  }

  const handleImageClick = (id) => {
    imageTargetId.current = id
    imageInputRef.current.click()
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file || !imageTargetId.current) return
    setUploadingImageFor(imageTargetId.current)
    try {
      await uploadProductImage(imageTargetId.current, file)
      load()
    } finally {
      setUploadingImageFor(null)
      e.target.value = ''
    }
  }

  const handleImageDelete = async (id) => {
    await deleteProductImage(id)
    load()
  }

  // ── Category CRUD ────────────────────────────────────────────────────────────

  const resetCatForm = () => {
    setCatName('')
    setCatDescription('')
    setEditCatId(null)
    setShowCatForm(false)
  }

  const handleCatEdit = (c) => {
    setCatName(c.name)
    setCatDescription(c.description || '')
    setEditCatId(c.id)
    setShowCatForm(true)
  }

  const handleCatSubmit = async (e) => {
    e.preventDefault()
    const data = { name: catName, description: catDescription || null }
    if (editCatId) {
      await updateCategory(editCatId, data)
    } else {
      await createCategory(data)
    }
    resetCatForm()
    load()
  }

  const handleCatDelete = async (id) => {
    if (!confirm('Удалить категорию? Услуги останутся без категории.')) return
    await deleteCategory(id)
    if (selectedCat === id) setSelectedCat(null)
    load()
  }

  // ── Filtered products ────────────────────────────────────────────────────────

  const filtered =
    selectedCat === null
      ? products
      : selectedCat === 'none'
        ? products.filter((p) => !p.category_id)
        : products.filter((p) => p.category_id === selectedCat)

  const countFor = (id) => products.filter((p) => p.category_id === id).length
  const uncategorized = products.filter((p) => !p.category_id).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Услуги</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { resetCatForm(); setShowCatForm(true) }}
            className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Категория
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Новая услуга
          </button>
        </div>
      </div>

      {/* Global discount */}
      <div className="bg-surface border border-slate-700/50 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-300">Глобальная скидка</div>
            <div className="text-xs text-slate-500 mt-0.5">Применяется ко всем услугам, у которых нет индивидуальной скидки</div>
          </div>
          <form onSubmit={handleSaveGlobal} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-24 bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 pr-7"
                value={globalDiscountInput}
                onChange={(e) => setGlobalDiscountInput(e.target.value)}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <button
              type="submit"
              disabled={savingGlobal}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {savingGlobal ? '...' : 'Сохранить'}
            </button>
          </form>
        </div>
        {globalDiscount > 0 && (
          <div className="mt-2 text-xs text-amber-400">
            Активна глобальная скидка {globalDiscount}% — услуги без индивидуальной скидки отображаются со скидкой
          </div>
        )}
      </div>

      {/* Category form */}
      {showCatForm && (
        <div className="bg-surface border border-slate-700/50 rounded-xl p-4 mb-4">
          <div className="text-sm font-medium text-slate-300 mb-3">
            {editCatId ? 'Редактировать категорию' : 'Новая категория'}
          </div>
          <form onSubmit={handleCatSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Название *</label>
                <input
                  required
                  className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Например: World of Warcraft"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Описание <span className="text-slate-600">(показывается в TG-боте)</span></label>
                <input
                  className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="Необязательно"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetCatForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                Отмена
              </button>
              <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">
                {editCatId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setSelectedCat(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedCat === null ? 'bg-brand-500 text-white' : 'bg-surface text-slate-400 hover:text-white'
          }`}
        >
          Все ({products.length})
        </button>
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedCat(c.id)}
              className={`px-3 py-1.5 rounded-l-lg text-sm font-medium transition-colors ${
                selectedCat === c.id ? 'bg-brand-500 text-white' : 'bg-surface text-slate-400 hover:text-white'
              }`}
            >
              {c.name} ({countFor(c.id)})
            </button>
            <button
              onClick={() => handleCatEdit(c)}
              className={`px-2 py-1.5 text-xs transition-colors ${
                selectedCat === c.id ? 'bg-brand-600 text-white' : 'bg-surface text-slate-500 hover:text-slate-300'
              }`}
              title="Переименовать"
            >
              ✎
            </button>
            <button
              onClick={() => handleCatDelete(c.id)}
              className={`px-2 py-1.5 rounded-r-lg text-xs transition-colors ${
                selectedCat === c.id ? 'bg-brand-600 text-white hover:bg-red-500' : 'bg-surface text-slate-500 hover:text-red-400'
              }`}
              title="Удалить категорию"
            >
              ✕
            </button>
          </div>
        ))}
        {uncategorized > 0 && (
          <button
            onClick={() => setSelectedCat('none')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCat === 'none' ? 'bg-brand-500 text-white' : 'bg-surface text-slate-400 hover:text-white'
            }`}
          >
            Без категории ({uncategorized})
          </button>
        )}
      </div>

      {/* Product form */}
      {showForm && (
        <div className="bg-surface border border-slate-700/50 rounded-xl p-5 mb-5">
          <div className="text-sm font-medium text-slate-300 mb-4">
            {editId ? 'Редактировать услугу' : 'Новая услуга'}
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Название *</label>
              <input
                required
                className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Прокачка 1-60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Цена (₽) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="1500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Скидка (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Категория</label>
              <select
                className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Без категории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-xs text-slate-500 mb-1">Описание</label>
              <input
                className="w-full bg-base border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Необязательно"
              />
            </div>
            <div className="col-span-5 flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                Отмена
              </button>
              <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hidden image input */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

      {/* Products grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((p) => {
          const effectiveDiscount = p.discount_percent > 0 ? p.discount_percent : globalDiscount
          const discountedPrice = effectiveDiscount > 0
            ? Math.round(p.price * (1 - effectiveDiscount / 100) * 100) / 100
            : null
          return (
          <div key={p.id} className={`bg-surface border rounded-xl overflow-hidden transition-opacity ${p.is_active ? 'border-slate-700/50' : 'border-slate-700/20 opacity-50'}`}>
            {/* Image */}
            <div className="relative h-28 bg-base group">
              {p.image_url ? (
                <img src={`${API_BASE()}${p.image_url}`} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">Нет фото</div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => handleImageClick(p.id)}
                  disabled={uploadingImageFor === p.id}
                  className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  {uploadingImageFor === p.id ? '...' : p.image_url ? 'Заменить' : 'Загрузить'}
                </button>
                {p.image_url && (
                  <button
                    onClick={() => handleImageDelete(p.id)}
                    className="text-xs px-2 py-1 rounded bg-red-500/30 hover:bg-red-500/50 text-red-300 transition-colors"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
            <div className="p-5">
            {p.category && (
              <div className="text-xs text-brand-400 mb-1">{p.category.name}</div>
            )}
            <div className="flex items-start justify-between mb-2">
              <div className="font-medium text-white">{p.name}</div>
              <div className="text-right">
                {discountedPrice ? (
                  <>
                    <div className="text-xs text-slate-500 line-through">{p.price} ₽</div>
                    <div className="text-lg font-bold text-green-400">{discountedPrice} ₽</div>
                    <div className="text-xs text-amber-400">-{effectiveDiscount}%{p.discount_percent === 0 && ' (глоб.)'}</div>
                  </>
                ) : (
                  <div className="text-lg font-bold text-green-400">{p.price} ₽</div>
                )}
              </div>
            </div>
            {p.description && <div className="text-xs text-slate-500 mb-3">{p.description}</div>}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleToggle(p)} className={`text-xs px-2 py-1 rounded transition-colors ${p.is_active ? 'bg-green-400/10 text-green-400 hover:bg-green-400/20' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                {p.is_active ? 'Активна' : 'Скрыта'}
              </button>
              <button onClick={() => handleEdit(p)} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                Изменить
              </button>
              <button onClick={() => handleDelete(p.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-400/10 transition-colors ml-auto">
                Удалить
              </button>
            </div>
            </div>
          </div>
        )})}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center text-slate-500 py-12">Услуг нет</div>
        )}
      </div>
    </div>
  )
}
