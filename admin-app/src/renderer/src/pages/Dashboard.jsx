import { useEffect, useState } from 'react'
import { getDashboard } from '../api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const STATUS_COLORS = {
  paid: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#8b5cf6',
  confirmed: '#10b981',
}

const STATUS_LABELS = {
  paid: 'Оплачен',
  in_progress: 'В работе',
  completed: 'Выполнен',
  confirmed: 'Подтверждён',
}

const SOURCE_COLORS = { funpay: '#ff6b35', telegram: '#229ed9', other: '#64748b' }

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-surface border border-border/50 rounded-xl p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-slate-500">Загрузка...</div>
  if (!stats) return <div className="p-8 text-red-400">Ошибка загрузки</div>

  const statusPieData = Object.entries(stats.orders_by_status).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k,
    value: v,
    color: STATUS_COLORS[k] || '#64748b',
  }))

  const sourcePieData = Object.entries(stats.orders_by_source).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
    color: SOURCE_COLORS[k] || '#64748b',
  }))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Дашборд</h1>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Выручка (подтверждённые)"
          value={`${stats.total_revenue.toFixed(0)} ₽`}
          color="text-green-400"
        />
        <StatCard
          label="Средний чек"
          value={`${stats.avg_order_value.toFixed(0)} ₽`}
          sub="По подтверждённым заказам"
          color="text-emerald-400"
        />
        <StatCard label="Всего заказов" value={stats.total_orders} />
        <StatCard
          label="К выплате качерам"
          value={`${stats.worker_earnings_pending.toFixed(0)} ₽`}
          color="text-yellow-400"
        />
        <StatCard
          label="Выплачено качерам"
          value={`${stats.worker_earnings_paid.toFixed(0)} ₽`}
          color="text-slate-300"
        />
      </div>

      {/* Profit split */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Выплаты медиа"
          value={`${(stats.media_total || 0).toFixed(0)} ₽`}
          sub="Сумма по промокодам (подтверждённые заказы)"
          color="text-orange-400"
        />
        <StatCard
          label="Прибыль владельца №1"
          value={`${stats.owner1_profit.toFixed(0)} ₽`}
          sub="VIP качеры: весь остаток · Не-VIP: 40% от остатка"
          color="text-brand-400"
        />
        <StatCard
          label="Прибыль владельца №2"
          value={`${stats.owner2_profit.toFixed(0)} ₽`}
          sub="Не-VIP качеры: 60% от остатка"
          color="text-purple-400"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Revenue by day */}
        <div className="bg-surface border border-border/50 rounded-xl p-5">
          <div className="text-sm font-medium text-slate-300 mb-4">Выручка по дням</div>
          {stats.revenue_by_day.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.revenue_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#4f73f5" strokeWidth={2} dot={false} name="Выручка" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orders by status */}
        <div className="bg-surface border border-border/50 rounded-xl p-5">
          <div className="text-sm font-medium text-slate-300 mb-4">Заказы по статусам</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {statusPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Source pie */}
        <div className="bg-surface border border-border/50 rounded-xl p-5">
          <div className="text-sm font-medium text-slate-300 mb-4">Источники заказов</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sourcePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                {sourcePieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div className="bg-surface border border-border/50 rounded-xl p-5 col-span-2">
          <div className="text-sm font-medium text-slate-300 mb-4">Топ услуг</div>
          {stats.top_products.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.top_products} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#4f73f5" radius={[0, 4, 4, 0]} name="Заказов" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Workers table */}
      <div className="bg-surface border border-border/50 rounded-xl p-5">
        <div className="text-sm font-medium text-slate-300 mb-4">Статистика качеров</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase border-b border-border/50">
              <th className="text-left pb-2">Качер</th>
              <th className="text-center pb-2">VIP</th>
              <th className="text-right pb-2">%</th>
              <th className="text-right pb-2">Всего заказов</th>
              <th className="text-right pb-2">Выполнено</th>
              <th className="text-right pb-2">К выплате</th>
              <th className="text-right pb-2">Выплачено</th>
            </tr>
          </thead>
          <tbody>
            {stats.workers_stats.map((w) => (
              <tr key={w.worker_id} className="border-b border-border/30 hover:bg-slate-700/10">
                <td className="py-2.5 text-white font-medium">{w.username}</td>
                <td className="py-2.5 text-center">
                  {w.is_vip ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400">VIP</span> : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="py-2.5 text-right text-slate-400">{w.worker_percentage}%</td>
                <td className="py-2.5 text-right text-slate-400">{w.total_orders}</td>
                <td className="py-2.5 text-right text-green-400">{w.completed_orders}</td>
                <td className="py-2.5 text-right text-yellow-400">{w.earnings_pending.toFixed(0)} ₽</td>
                <td className="py-2.5 text-right text-slate-400">{w.earnings_paid.toFixed(0)} ₽</td>
              </tr>
            ))}
            {stats.workers_stats.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500">Нет качеров</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
