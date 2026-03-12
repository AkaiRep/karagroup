import { useEffect, useState } from 'react'
import { getMyTransactions } from '../api'

const TX_STATUS = { pending: 'К выплате', paid: 'Выплачено' }

export default function Earnings() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyTransactions().then(setTransactions).finally(() => setLoading(false))
  }, [])

  const pending = transactions.filter((t) => t.status === 'pending').reduce((a, t) => a + t.amount, 0)
  const paid = transactions.filter((t) => t.status === 'paid').reduce((a, t) => a + t.amount, 0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Мои заработки</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">К выплате</div>
          <div className="text-3xl font-bold text-yellow-400">{pending.toFixed(0)} ₽</div>
        </div>
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Выплачено</div>
          <div className="text-3xl font-bold text-green-400">{paid.toFixed(0)} ₽</div>
        </div>
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Всего выполнено</div>
          <div className="text-3xl font-bold text-white">{transactions.length}</div>
        </div>
      </div>

      <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase border-b border-slate-700/50">
              <th className="text-left px-5 py-3">Заказ</th>
              <th className="text-left px-5 py-3">Услуга</th>
              <th className="text-right px-5 py-3">Сумма заказа</th>
              <th className="text-right px-5 py-3">Ваш заработок</th>
              <th className="text-center px-5 py-3">Статус</th>
              <th className="text-left px-5 py-3">Дата</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">Загрузка...</td>
              </tr>
            ) : transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-slate-700/30 hover:bg-slate-700/10">
                <td className="px-5 py-3 text-slate-400">
                  <div>#{tx.order_id}</div>
                  {tx.order?.external_id && <div className="text-xs text-slate-600">{tx.order.external_id}</div>}
                </td>
                <td className="px-5 py-3 text-slate-300">{tx.order?.product?.name || '—'}</td>
                <td className="px-5 py-3 text-right text-slate-400">{tx.order?.price?.toFixed(0)} ₽</td>
                <td className="px-5 py-3 text-right font-bold text-white">{tx.amount.toFixed(0)} ₽</td>
                <td className="px-5 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'pending' ? 'bg-yellow-400/15 text-yellow-400' : 'bg-green-400/15 text-green-400'}`}>
                    {TX_STATUS[tx.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">
                  {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">Заработков нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
