import { useEffect, useState, useCallback } from 'react'
import { getHealth } from '../api'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-400' : 'bg-red-500'}`} />
  )
}

function Card({ title, icon, children }) {
  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700/50 bg-[#151922] flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <h2 className="font-semibold text-slate-200 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, ok, mono = false, sub }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-700/30 last:border-0">
      <div>
        <span className="text-sm text-slate-400">{label}</span>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        {ok !== undefined && <StatusDot ok={ok} />}
        <span className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${ok === false ? 'text-red-400' : 'text-slate-200'}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

const CHART_THEME = {
  grid: '#1e2535',
  text: '#64748b',
  tooltip: { bg: '#1a1f2e', border: '#334155' },
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f2e] border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Health() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const result = await getHealth()
      setData(result)
      setLastUpdated(new Date())
    } catch (e) {
      setError('Не удалось получить данные. Проверьте подключение к API.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 15000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Здоровье системы</h1>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-1">
              Обновлено: {lastUpdated.toLocaleTimeString('ru-RU')} · автообновление каждые 15с
            </p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-slate-700 hover:border-green-500/40 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Обновить
        </button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#1a1f2e] rounded-xl h-32 animate-pulse border border-slate-700/50" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400 text-sm">{error}</div>
      )}

      {data && !loading && (
        <div className="space-y-4">

          {/* Overall status */}
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${data.ok ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${data.ok ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {data.ok ? '✅' : '❌'}
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-lg ${data.ok ? 'text-green-400' : 'text-red-400'}`}>
                {data.ok ? 'Система работает нормально' : 'Обнаружены проблемы'}
              </p>
              <p className="text-slate-400 text-sm">Аптайм: {data.uptime}</p>
            </div>
          </div>

          {/* Telegram */}
          {data.telegram && (
            <Card title="Telegram" icon="✈️">
              <Row
                label="Бот"
                value={data.telegram.bot_ok ? `@${data.telegram.bot_username}` : 'Недоступен'}
                ok={data.telegram.bot_ok}
                sub={data.telegram.bot_error}
              />
              <Row
                label="Ping Telegram API"
                value={data.telegram.tg_latency_ms != null ? `${data.telegram.tg_latency_ms} мс` : '—'}
                ok={data.telegram.tg_servers_ok}
                mono
                sub={data.telegram.tg_servers_error}
              />
              <Row
                label="Серверы Telegram"
                value={data.telegram.tg_servers_ok ? 'Работают' : 'Проблемы'}
                ok={data.telegram.tg_servers_ok}
              />
            </Card>
          )}

          {/* DB + counts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="База данных" icon="🗄️">
              <Row
                label="Подключение"
                value={data.database.ok ? 'Работает' : 'Ошибка'}
                ok={data.database.ok}
              />
              {data.database.latency_ms != null && (
                <Row
                  label="Задержка"
                  value={`${data.database.latency_ms} мс`}
                  ok={data.database.latency_ms < 50}
                  mono
                />
              )}
              {data.db_error && <p className="text-red-400 text-xs mt-2 font-mono">{data.db_error}</p>}
            </Card>

            {data.counts && (
              <Card title="Статистика" icon="📊">
                <Row label="Заказов всего" value={data.counts.orders_total} />
                <Row label="Активных" value={data.counts.orders_active} ok={data.counts.orders_active >= 0} />
                <Row label="Ожидают оплаты" value={data.counts.orders_pending_payment} ok={data.counts.orders_pending_payment === 0} />
                <Row label="Пользователей" value={data.counts.users_total} />
                <Row label="Услуг (акт./всего)" value={`${data.counts.products_active} / ${data.counts.products_total}`} />
              </Card>
            )}
          </div>

          {/* Charts */}
          {data.history && data.history.length > 1 && (
            <>
              <Card title="Задержка базы данных (мс)" icon="📈">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis dataKey="t" tick={{ fill: CHART_THEME.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} unit=" мс" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="db_ms" name="DB latency" stroke="#22c55e" fill="url(#dbGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Задержка Telegram API (мс)" icon="✈️">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis dataKey="t" tick={{ fill: CHART_THEME.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} unit=" мс" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="tg_ms" name="TG latency" stroke="#3b82f6" fill="url(#tgGrad)" strokeWidth={2} dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Активность заказов" icon="📦">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis dataKey="t" tick={{ fill: CHART_THEME.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: CHART_THEME.text }} />
                    <Line type="monotone" dataKey="orders_active" name="Активные" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="orders_pending" name="Ожидают оплаты" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {data.history && data.history.length <= 1 && (
            <div className="bg-[#1a1f2e] rounded-xl border border-slate-700/50 p-6 text-center text-slate-500 text-sm">
              Графики появятся после нескольких обновлений (обновляй страницу)
            </div>
          )}

          {/* Env */}
          {data.env && (
            <Card title="Переменные окружения" icon="⚙️">
              {Object.entries(data.env).map(([key, val]) => (
                <Row key={key} label={key} value={val ? 'Настроено' : 'Не задано'} ok={val} mono />
              ))}
            </Card>
          )}

        </div>
      )}
    </div>
  )
}
