import { useEffect, useState } from 'react'
import { getAllMyOrders, completeOrder } from '../api'
import ChatPanel from '../components/ChatPanel'
import { useChatStore } from '../store'

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

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [chatOrderId, setChatOrderId] = useState(null)
  const [completing, setCompleting] = useState(null)
  const { unread, markRead, closeChat } = useChatStore()

  const load = async () => {
    setLoading(true)
    const data = await getAllMyOrders()
    setOrders(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleComplete = async (id) => {
    setCompleting(id)
    try {
      await completeOrder(id)
      await load()
    } finally {
      setCompleting(null)
    }
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

  const activeOrders = orders.filter((o) => o.status === 'in_progress')
  const doneOrders = orders.filter((o) => o.status !== 'in_progress')

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Мои заказы</h1>
          <div className="text-sm text-slate-500">
            Активных: <span className="text-blue-400 font-medium">{activeOrders.length}/3</span>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-500">Загрузка...</div>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <div className="mb-6">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">В работе</div>
                <div className="space-y-3">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onComplete={handleComplete}
                      completing={completing === order.id}
                      onChat={() => openChat(order.id)}
                      chatOpen={chatOrderId === order.id}
                      unreadCount={unread[String(order.id)] || 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {doneOrders.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">История</div>
                <div className="space-y-2">
                  {doneOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onChat={() => openChat(order.id)}
                      chatOpen={chatOrderId === order.id}
                      unreadCount={unread[String(order.id)] || 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {orders.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                <div className="text-4xl mb-4">📋</div>
                <div>У вас пока нет заказов</div>
              </div>
            )}
          </>
        )}
      </div>

      {chatOrderId && (
        <div className="w-72 flex-shrink-0 flex flex-col border-l border-slate-700/50">
          <ChatPanel orderId={chatOrderId} onClose={() => { setChatOrderId(null); closeChat() }} />
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, onComplete, completing, onChat, chatOpen, unreadCount }) {
  return (
    <div className={`bg-[#1a1f2e] border rounded-xl p-4 transition-colors ${chatOpen ? 'border-brand-500/40' : 'border-slate-700/50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-slate-400 text-sm">#{order.id}</span>
            {order.external_id && <span className="text-xs text-slate-600">{order.external_id}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status]}`}>
              {STATUS_LABEL[order.status]}
            </span>
            <span className="text-xs text-slate-600">{SOURCE_LABEL[order.source]}</span>
          </div>
          {/* Services list */}
          <div className="flex flex-wrap gap-1 mb-1">
            {order.items.length === 0 && <span className="text-slate-400 text-sm">—</span>}
            {order.items.map((item) => (
              <span key={item.id} className="font-medium text-white text-sm">
                {item.product?.category && (
                  <span className="text-brand-400/70 text-xs mr-1">{item.product.category.name} /</span>
                )}
                {item.quantity > 1 && <span className="text-brand-400 mr-1">{item.quantity}×</span>}
                {item.product?.name}
                {item.discount > 0 && <span className="ml-1 text-xs text-green-400">-{item.discount}%</span>}
                {item.subregions?.length > 0 && (
                  <span className="ml-1 text-xs text-purple-400">
                    [{item.subregions.map((s) => `${s.name} (${s.price}₽)`).join(', ')}]
                  </span>
                )}
              </span>
            ))}
          </div>
          {order.notes && <div className="text-xs text-slate-500">{order.notes}</div>}
          {order.client_info && <div className="text-xs text-slate-500">Клиент: {order.client_info}</div>}
        </div>
        {/* Only show worker_earnings, never order.price */}
        <div className="text-right ml-4 flex-shrink-0">
          {order.worker_earnings != null ? (
            <>
              <div className="text-xs text-slate-500 mb-0.5">Ваш заработок</div>
              <div className="text-xl font-bold text-brand-400">+{order.worker_earnings} ₽</div>
            </>
          ) : (
            <div className="text-xs text-slate-600">Ставка рассчитается при взятии</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={onChat}
          className={`relative text-xs px-3 py-1.5 rounded transition-colors ${chatOpen ? 'bg-brand-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}
        >
          Чат
          {unreadCount > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {order.status === 'in_progress' && onComplete && (
          <button
            onClick={() => onComplete(order.id)}
            disabled={completing}
            className="text-xs px-3 py-1.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-50 transition-colors ml-auto"
          >
            {completing ? '...' : 'Отметить выполненным'}
          </button>
        )}
        {order.status === 'completed' && (
          <span className="text-xs text-slate-500 ml-auto">Ожидает подтверждения</span>
        )}
        {order.status === 'confirmed' && (
          <span className="text-xs text-green-400 ml-auto">Подтверждён ✓</span>
        )}
      </div>
    </div>
  )
}
