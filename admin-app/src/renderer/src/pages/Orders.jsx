import { useEffect, useState, useCallback } from 'react'
import {
  getOrders, getProducts, getUsers, createOrder,
  updateOrderStatus, deleteOrder, lookupPromoCode, getGlobalDiscount, removeWorkerFromOrder,
} from '../api'
import ChatPanel from '../components/ChatPanel'
import { useChatStore } from '../store'

function fmtOrderDuration(order) {
  if (!order.taken_at) return null
  const start = new Date(order.taken_at)
  const end = order.completed_at ? new Date(order.completed_at) : new Date()
  const secs = Math.floor((end - start) / 1000)
  if (secs < 60) return '< 1 мин'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}ч ${m}м` : `${m} мин`
}

const STATUS_LABEL = {
  paid: 'Оплачен',
  in_progress: 'В работе',
  completed: 'Выполнен',
  confirmed: 'Подтверждён',
}
const STATUS_COLOR = {
  paid: 'bg-yellow-400/15 text-yellow-400',
  in_progress: 'bg-blue-400/15 text-blue-400',
  completed: 'bg-purple-400/15 text-purple-400',
  confirmed: 'bg-green-400/15 text-green-400',
}
const SOURCE_LABEL = { funpay: 'FunPay', telegram: 'Telegram', other: 'Другое' }
const STATUS_ORDER = ['paid', 'in_progress', 'completed', 'confirmed']

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [workers, setWorkers] = useState([])
  const [globalDiscount, setGlobalDiscountState] = useState(0)
  const [loading, setLoading] = useState(true)
  const [chatOrderId, setChatOrderId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoInfo, setPromoInfo] = useState(null)   // resolved promo code object
  const [promoError, setPromoError] = useState('')

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterWorker, setFilterWorker] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterPriceMin, setFilterPriceMin] = useState('')
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { unread, markRead, closeChat, setActiveChatOrderId } = useChatStore()

  // Order form
  const [form, setForm] = useState({
    external_id: '',
    source: 'other',
    items: [],       // [{product_id, discount}]
    price: '',
    notes: '',
    client_info: '',
    client_url: '',
  })

  const buildParams = () => {
    const p = {}
    if (filterStatus) p.status = filterStatus
    if (filterSource) p.source = filterSource
    if (filterWorker) p.worker_id = filterWorker
    if (filterSearch) p.search = filterSearch
    if (filterDateFrom) p.date_from = filterDateFrom
    if (filterDateTo) p.date_to = filterDateTo
    if (filterPriceMin) p.price_min = filterPriceMin
    if (filterPriceMax) p.price_max = filterPriceMax
    return p
  }

  const load = useCallback(async () => {
    const [o, p, u, gd] = await Promise.all([
      getOrders(buildParams()),
      getProducts(),
      getUsers(),
      getGlobalDiscount(),
    ])
    setOrders(o)
    setProducts(p)
    setWorkers(u.filter((u) => u.role === 'worker'))
    setGlobalDiscountState(gd.value)
    setLoading(false)
  }, [filterStatus, filterSource, filterWorker, filterSearch, filterDateFrom, filterDateTo, filterPriceMin, filterPriceMax])

  useEffect(() => {
    load()
  }, [load])

  const calcSuggestedPrice = (items) =>
    items.reduce((sum, { product_id, quantity, discount }) => {
      const p = products.find((p) => p.id === product_id)
      return sum + (p?.price || 0) * (quantity || 1) * (1 - (discount || 0) / 100)
    }, 0)

  const toggleProduct = (id) => {
    const p = products.find((p) => p.id === id)
    const effectiveDiscount = p?.discount_percent > 0 ? p.discount_percent : (globalDiscount || 0)
    setForm((prev) => {
      const exists = prev.items.find((i) => i.product_id === id)
      const items = exists
        ? prev.items.filter((i) => i.product_id !== id)
        : [...prev.items, { product_id: id, quantity: 1, discount: effectiveDiscount }]
      const suggested = calcSuggestedPrice(items)
      return { ...prev, items, price: suggested > 0 ? String(Math.round(suggested * 100) / 100) : prev.price }
    })
  }

  const setItemField = (productId, field, value) => {
    setForm((prev) => {
      const items = prev.items.map((i) =>
        i.product_id === productId ? { ...i, [field]: Number(value) } : i
      )
      const suggested = calcSuggestedPrice(items)
      return { ...prev, items, price: String(Math.round(suggested * 100) / 100) }
    })
  }

  const applyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoError('')
    try {
      const p = await lookupPromoCode(promoInput.trim())
      setPromoInfo(p)
      // Recalculate price with discount
      const base = Number(form.price)
      if (base > 0) {
        const discounted = Math.round(base * (1 - p.discount_percent / 100) * 100) / 100
        setForm((prev) => ({ ...prev, price: String(discounted) }))
      }
    } catch {
      setPromoError('Промокод не найден или неактивен')
      setPromoInfo(null)
    }
  }

  const clearPromo = () => {
    setPromoInfo(null)
    setPromoInput('')
    setPromoError('')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    await createOrder({
      ...form,
      price: Number(form.price),
      promo_code: promoInfo ? promoInfo.code : undefined,
    })
    setShowForm(false)
    setProductSearch('')
    setPromoInput('')
    setPromoInfo(null)
    setPromoError('')
    setForm({ external_id: '', source: 'other', items: [], price: '', notes: '', client_info: '', client_url: '' })
    load()
  }

  const handleStatusChange = async (orderId, status) => {
    await updateOrderStatus(orderId, status)
    load()
  }

  const handleRemoveWorker = async (id) => {
    if (!confirm('Снять качера с заказа? Заказ вернётся в статус "Оплачен".')) return
    await removeWorkerFromOrder(id)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить заказ?')) return
    await deleteOrder(id)
    load()
  }

  const openChat = (orderId) => {
    if (chatOrderId === orderId) {
      setChatOrderId(null)
      closeChat()
    } else {
      setChatOrderId(orderId)
      markRead(orderId)
    }
  }

  const activeFiltersCount = [filterStatus, filterSource, filterWorker, filterSearch, filterDateFrom, filterDateTo, filterPriceMin, filterPriceMax].filter(Boolean).length

  return (
    <div className="flex min-h-full">
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">Заказы</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`relative text-sm px-4 py-2 rounded-lg border transition-colors ${showFilters || activeFiltersCount > 0 ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
            >
              Фильтры
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              + Новый заказ
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4 mb-4 flex-shrink-0">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Статус</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-brand-500">
                  <option value="">Все</option>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Источник</label>
                <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-brand-500">
                  <option value="">Все</option>
                  <option value="funpay">FunPay</option>
                  <option value="telegram">Telegram</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Качер</label>
                <select value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-brand-500">
                  <option value="">Все</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Поиск (ID / клиент)</label>
                <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="FP-123 или ник"
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Дата от</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Дата до</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Цена от (₽)</label>
                <input type="number" min="0" value={filterPriceMin} onChange={(e) => setFilterPriceMin(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Цена до (₽)</label>
                <input type="number" min="0" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)}
                  placeholder="∞"
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setFilterStatus(''); setFilterSource(''); setFilterWorker('')
                  setFilterSearch(''); setFilterDateFrom(''); setFilterDateTo('')
                  setFilterPriceMin(''); setFilterPriceMax('')
                }}
                className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Сбросить все фильтры
              </button>
            )}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5 mb-4 flex-shrink-0">
            <div className="text-sm font-medium text-slate-300 mb-4">Новый заказ</div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">ID заказа (вручную)</label>
                  <input
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    value={form.external_id}
                    onChange={(e) => setForm({ ...form, external_id: e.target.value })}
                    placeholder="FP-12345"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Источник</label>
                  <select
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  >
                    <option value="funpay">FunPay</option>
                    <option value="telegram">Telegram</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Итоговая цена (₽) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="Авто при выборе услуг"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Клиент</label>
                  <input
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    value={form.client_info}
                    onChange={(e) => setForm({ ...form, client_info: e.target.value })}
                    placeholder="Ник или контакт"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Заметки</label>
                  <input
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ссылка на клиента</label>
                  <input
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    value={form.client_url}
                    onChange={(e) => setForm({ ...form, client_url: e.target.value })}
                    placeholder="https://funpay.com/..."
                  />
                </div>
              </div>

              {/* Promo code */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Промокод</label>
                <div className="flex items-center gap-2">
                  <input
                    className="bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 uppercase w-40"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoInfo(null); setPromoError('') }}
                    placeholder="VASYA10"
                    disabled={!!promoInfo}
                  />
                  {!promoInfo ? (
                    <button type="button" onClick={applyPromo} className="text-xs px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                      Применить
                    </button>
                  ) : (
                    <button type="button" onClick={clearPromo} className="text-xs px-3 py-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                      Убрать
                    </button>
                  )}
                  {promoInfo && (
                    <span className="text-xs text-green-400 flex items-center gap-1.5">
                      ✓ скидка {promoInfo.discount_percent}% · медиа {promoInfo.media_percent}%
                    </span>
                  )}
                  {promoError && <span className="text-xs text-red-400">{promoError}</span>}
                </div>
              </div>

              {/* Multi-product selector */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Услуги <span className="text-slate-600">(скидка % применяется к базовой цене)</span>
                </label>
                <input
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 mb-2"
                  placeholder="Поиск услуги..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto">
                  {products.filter((p) => p.is_active && p.name.toLowerCase().includes(productSearch.toLowerCase())).map((p) => {
                    const selected = form.items.some((i) => i.product_id === p.id)
                    const effDisc = p.discount_percent > 0 ? p.discount_percent : (globalDiscount || 0)
                    const shownPrice = effDisc > 0
                      ? Math.round(p.price * (1 - effDisc / 100) * 100) / 100
                      : p.price
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProduct(p.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          selected
                            ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        {p.name} — {shownPrice} ₽{effDisc > 0 && <span className="ml-1 text-amber-400">-{effDisc}%</span>}
                      </button>
                    )
                  })}
                  {products.filter((p) => p.is_active && p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                    <span className="text-xs text-slate-600">{productSearch ? 'Ничего не найдено' : 'Нет активных услуг'}</span>
                  )}
                </div>
                {form.items.length > 0 && (
                  <div className="space-y-1.5">
                    {form.items.map(({ product_id, quantity, discount }) => {
                      const p = products.find((p) => p.id === product_id)
                      if (!p) return null
                      const finalPrice = p.price * (quantity || 1) * (1 - discount / 100)
                      return (
                        <div key={product_id} className="flex items-center gap-3 bg-[#0f1117] rounded-lg px-3 py-2">
                          <span className="text-xs text-slate-300 flex-1">{p.name}</span>
                          <span className="text-xs text-slate-500">{p.price} ₽/шт</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Кол-во</span>
                            <input
                              type="number" min="1" step="1"
                              value={quantity}
                              onChange={(e) => setItemField(product_id, 'quantity', e.target.value)}
                              className="w-14 bg-[#1a1f2e] border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-brand-500 text-center"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Скидка</span>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={discount}
                              onChange={(e) => setItemField(product_id, 'discount', e.target.value)}
                              className="w-14 bg-[#1a1f2e] border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-brand-500 text-center"
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                          <span className={`text-xs font-medium w-20 text-right ${discount > 0 ? 'text-green-400' : 'text-slate-300'}`}>
                            = {finalPrice.toFixed(2)} ₽
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                  Отмена
                </button>
                <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">
                  Создать
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-slate-500">Загрузка...</div>
        ) : (
          <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-slate-700/50">
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Источник</th>
                  <th className="text-left px-4 py-3">Услуги</th>
                  <th className="text-left px-4 py-3">Клиент</th>
                  <th className="text-right px-4 py-3">Цена</th>
                  <th className="text-left px-4 py-3">Статус</th>
                  <th className="text-left px-4 py-3">Качер</th>
                  <th className="text-right px-4 py-3">Время</th>
                  <th className="text-right px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-700/30 hover:bg-slate-700/10">
                    <td className="px-4 py-3 text-slate-400">
                      <div>#{order.id}</div>
                      {order.external_id && <div className="text-xs text-slate-600">{order.external_id}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        order.source === 'funpay' ? 'bg-orange-400/15 text-orange-400'
                          : order.source === 'telegram' ? 'bg-sky-400/15 text-sky-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {SOURCE_LABEL[order.source]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {order.items.length === 0 && <span className="text-slate-600 text-xs">—</span>}
                        {order.items.map((item) => (
                          <span key={item.id} className="text-xs bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">
                            {item.quantity > 1 && <span className="text-brand-400 mr-1">{item.quantity}×</span>}
                            {item.product?.name || '?'}
                            {item.discount > 0 && <span className="ml-1 text-green-400">-{item.discount}%</span>}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-400">{order.client_info || '—'}</div>
                      {order.client_url && (
                        <button
                          onClick={() => window.open(order.client_url, '_blank')}
                          className="text-brand-400 hover:text-brand-300 hover:underline mt-0.5 block truncate max-w-[140px]"
                          title={order.client_url}
                        >
                          🔗 открыть
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-white">{order.price} ₽</div>
                      {order.original_price && (
                        <div className="text-xs text-slate-500 line-through">{order.original_price} ₽</div>
                      )}
                      {order.media_earnings > 0 && (
                        <div className="text-xs text-purple-400">медиа: {order.media_earnings} ₽</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`text-xs rounded-full px-2 py-0.5 border-0 focus:outline-none cursor-pointer bg-transparent ${STATUS_COLOR[order.status]}`}
                      >
                        {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">{order.worker?.username || '—'}</span>
                        {order.worker && (
                          <button
                            onClick={() => handleRemoveWorker(order.id)}
                            className="text-orange-400 hover:bg-orange-400/10 px-1.5 py-0.5 rounded transition-colors"
                            title="Снять качера"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmtOrderDuration(order) ? (
                        <div className="text-xs">
                          <div className={order.completed_at ? 'text-slate-400' : 'text-blue-400'}>{fmtOrderDuration(order)}</div>
                          {!order.completed_at && order.taken_at && (
                            <div className="text-slate-600">в работе</div>
                          )}
                        </div>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openChat(order.id)}
                          className={`relative text-xs px-2 py-1 rounded transition-colors ${
                            chatOrderId === order.id
                              ? 'bg-brand-500 text-white'
                              : 'text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700'
                          }`}
                        >
                          Чат
                          {unread[String(order.id)] > 0 && chatOrderId !== order.id && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                              {unread[String(order.id)] > 9 ? '9+' : unread[String(order.id)]}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      Заказов нет {activeFiltersCount > 0 && '(попробуйте сбросить фильтры)'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chat panel */}
      {chatOrderId && (
        <div className="w-80 flex-shrink-0 border-l border-slate-700/50 sticky top-0 h-screen">
          <ChatPanel orderId={chatOrderId} onClose={() => { setChatOrderId(null); closeChat() }} />
        </div>
      )}
    </div>
  )
}
