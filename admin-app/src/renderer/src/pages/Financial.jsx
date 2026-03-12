import { useEffect, useState } from 'react'
import { getTransactions, payTransaction } from '../api'

const TX_STATUS = { pending: 'К выплате', paid: 'Выплачено' }

export default function Financial() {
  const [transactions, setTransactions] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const params = {}
    if (filterStatus) params.status = filterStatus
    const data = await getTransactions(params)
    setTransactions(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus])

  const handlePay = async (id) => {
    await payTransaction(id)
    load()
  }

  const totalPending = transactions.filter(t => t.status === 'pending').reduce((a, t) => a + t.amount, 0)
  const totalPaid = transactions.filter(t => t.status === 'paid').reduce((a, t) => a + t.amount, 0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Финансы</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">К выплате</div>
          <div className="text-3xl font-bold text-yellow-400">{totalPending.toFixed(0)} ₽</div>
        </div>
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Выплачено</div>
          <div className="text-3xl font-bold text-green-400">{totalPaid.toFixed(0)} ₽</div>
        </div>
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Всего транзакций</div>
          <div className="text-3xl font-bold text-white">{transactions.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#1a1f2e] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
        >
          <option value="">Все</option>
          <option value="pending">К выплате</option>
          <option value="paid">Выплачено</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase border-b border-slate-700/50">
              <th className="text-left px-5 py-3">Заказ</th>
              <th className="text-left px-5 py-3">Качер</th>
              <th className="text-left px-5 py-3">Услуга</th>
              <th className="text-right px-5 py-3">Сумма заказа</th>
              <th className="text-right px-5 py-3">Выплата качеру</th>
              <th className="text-center px-5 py-3">Статус</th>
              <th className="text-left px-5 py-3">Дата</th>
              <th className="text-center px-5 py-3">Действие</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-500">Загрузка...</td>
              </tr>
            ) : transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-slate-700/30 hover:bg-slate-700/10">
                <td className="px-5 py-3 text-slate-400">
                  <div>#{tx.order_id}</div>
                  {tx.order?.external_id && <div className="text-xs text-slate-600">{tx.order.external_id}</div>}
                </td>
                <td className="px-5 py-3 text-white font-medium">{tx.worker?.username || '—'}</td>
                <td className="px-5 py-3 text-slate-400">{tx.order?.product?.name || '—'}</td>
                <td className="px-5 py-3 text-right text-slate-300">{tx.order?.price?.toFixed(0)} ₽</td>
                <td className="px-5 py-3 text-right font-medium text-white">{tx.amount.toFixed(0)} ₽</td>
                <td className="px-5 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'pending' ? 'bg-yellow-400/15 text-yellow-400' : 'bg-green-400/15 text-green-400'}`}>
                    {TX_STATUS[tx.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">
                  {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                  {tx.paid_at && <div>Выплачено: {new Date(tx.paid_at).toLocaleDateString('ru-RU')}</div>}
                </td>
                <td className="px-5 py-3 text-center">
                  {tx.status === 'pending' && (
                    <button
                      onClick={() => handlePay(tx.id)}
                      className="text-xs bg-green-500/15 hover:bg-green-500/25 text-green-400 px-3 py-1 rounded transition-colors"
                    >
                      Выплатить
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-500">Транзакций нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
