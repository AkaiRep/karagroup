import { useEffect, useState, useCallback } from 'react'
import { getAvailableOrders, getMyOrders, takeOrder } from '../api'
import { useAuthStore } from '../store'

const SOURCE_LABEL = { funpay: 'FunPay', telegram: 'Telegram', other: 'Другое' }
const SOURCE_COLOR = {
  funpay: 'bg-orange-400/15 text-orange-400',
  telegram: 'bg-sky-400/15 text-sky-400',
  other: 'bg-slate-700 text-slate-400',
}

export default function AvailableOrders() {
  const [orders, setOrders] = useState([])
  const [activeCount, setActiveCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [taking, setTaking] = useState(null)
  const [error, setError] = useState('')
  const { user } = useAuthStore()

  const load = useCallback(async () => {
    const [avail, active] = await Promise.all([getAvailableOrders(), getMyOrders()])
    setOrders(avail)
    setActiveCount(active.length)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const handleTake = async (id) => {
    setError('')
    setTaking(id)
    try {
      await takeOrder(id)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка')
    } finally {
      setTaking(null)
    }
  }

  // Estimated earnings for a given order price
  const calcEarnings = (price) =>
    Math.round(price * (user?.worker_percentage ?? 70) / 100)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Доступные заказы</h1>
          <div className="text-sm text-slate-500 mt-1">
            Ваших активных:{' '}
            <span className={activeCount >= 3 ? 'text-red-400 font-medium' : 'text-brand-400 font-medium'}>
              {activeCount}/3
            </span>
          </div>
        </div>
        <button
          onClick={load}
          className="text-xs text-slate-500 hover:text-white px-3 py-1.5 rounded border border-slate-700/50 hover:border-slate-600 transition-colors"
        >
          Обновить
        </button>
      </div>

      {activeCount >= 3 && (
        <div className="mb-4 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          У вас уже 3 активных заказа. Завершите один из них, чтобы взять новый.
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <div className="text-4xl mb-4">🎮</div>
          <div>Свободных заказов нет</div>
          <div className="text-xs mt-1">Страница обновляется автоматически каждые 15 секунд</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-[#1a1f2e] border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-slate-500 text-xs">#{order.id}</span>
                    {order.external_id && <span className="text-xs text-slate-600">{order.external_id}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLOR[order.source]}`}>
                      {SOURCE_LABEL[order.source]}
                    </span>
                  </div>
                  {/* Services */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {order.items.length === 0 && <span className="text-slate-400 text-sm">Без услуги</span>}
                    {order.items.map((item) => (
                      <span key={item.id} className="text-sm text-white font-medium">
                        {item.product?.category && (
                          <span className="text-brand-400/70 text-xs mr-1">{item.product.category.name} /</span>
                        )}
                        {item.quantity > 1 && <span className="text-brand-400 mr-1">{item.quantity}×</span>}
                        {item.product?.name}
                        {item.discount > 0 && <span className="ml-1 text-xs text-green-400">-{item.discount}%</span>}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Show ONLY earnings, never the order price */}
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="text-xs text-slate-500 mb-0.5">Ваш заработок</div>
                  <div className="text-2xl font-bold text-brand-400">
                    {calcEarnings(order.price)} ₽
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">ставка {user?.worker_percentage}%</div>
                </div>
              </div>

              {order.notes && (
                <div className="text-xs text-slate-500 bg-[#0f1117] rounded-lg px-3 py-2 mb-3">
                  {order.notes}
                </div>
              )}

              {order.client_info && (
                <div className="text-xs text-slate-400 mb-3">
                  Клиент: <span className="text-slate-300">{order.client_info}</span>
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-slate-600">
                  {new Date(order.created_at).toLocaleDateString('ru-RU', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <button
                  onClick={() => handleTake(order.id)}
                  disabled={taking === order.id || activeCount >= 3}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors"
                >
                  {taking === order.id ? 'Берём...' : 'Взять заказ'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
