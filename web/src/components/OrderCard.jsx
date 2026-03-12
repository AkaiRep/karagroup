'use client'

const STATUS_LABELS = {
  pending_payment: { label: 'Ожидает оплаты', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  paid: { label: 'Ожидает исполнителя', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  in_progress: { label: 'В работе', color: 'text-green-400', bg: 'bg-green-400/10' },
  completed: { label: 'Выполнен', color: 'text-green-400', bg: 'bg-green-400/10' },
  confirmed: { label: 'Подтверждён', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  cancelled: { label: 'Отменён', color: 'text-red-400', bg: 'bg-red-400/10' },
}

export default function OrderCard({ order }) {
  const status = STATUS_LABELS[order.status] ?? { label: order.status, color: 'text-slate-400', bg: 'bg-slate-400/10' }

  const date = new Date(order.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="bg-[#111318] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-slate-500 text-sm">#{order.id}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
          <h3 className="font-semibold text-base">{order.product_name ?? 'Услуга'}</h3>
          <p className="text-slate-500 text-xs mt-1">{date}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-green-400">
            {Number(order.price).toLocaleString('ru-RU')} ₽
          </p>
        </div>
      </div>

      {order.notes && (
        <p className="mt-3 text-sm text-slate-400 border-t border-white/5 pt-3">{order.notes}</p>
      )}
    </div>
  )
}
