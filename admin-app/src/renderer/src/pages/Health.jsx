import { useEffect, useState, useCallback } from 'react'
import { getHealth } from '../api'

function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-400' : 'bg-red-500'}`} />
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700/50 bg-[#151922]">
        <h2 className="font-semibold text-slate-200 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, ok, mono = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {ok !== undefined && <StatusDot ok={ok} />}
        <span className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${ok === false ? 'text-red-400' : 'text-slate-200'}`}>
          {value}
        </span>
      </div>
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
    <div className="p-8 max-w-3xl">
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
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">

          {/* Overall */}
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${data.ok ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${data.ok ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {data.ok ? '✅' : '❌'}
            </div>
            <div>
              <p className={`font-semibold text-lg ${data.ok ? 'text-green-400' : 'text-red-400'}`}>
                {data.ok ? 'Система работает нормально' : 'Обнаружены проблемы'}
              </p>
              <p className="text-slate-400 text-sm">Аптайм: {data.uptime}</p>
            </div>
          </div>

          {/* Database */}
          <Card title="🗄️ База данных">
            <Row
              label="Подключение"
              value={data.database.ok ? 'Работает' : 'Ошибка'}
              ok={data.database.ok}
            />
            {data.database.latency_ms !== null && (
              <Row
                label="Задержка запроса"
                value={`${data.database.latency_ms} мс`}
                ok={data.database.latency_ms < 100}
                mono
              />
            )}
            {data.db_error && (
              <p className="text-red-400 text-xs mt-2 font-mono">{data.db_error}</p>
            )}
          </Card>

          {/* Counts */}
          {data.counts && (
            <Card title="📊 Статистика">
              <Row label="Заказов всего" value={data.counts.orders_total} />
              <Row
                label="Активных заказов"
                value={data.counts.orders_active}
                ok={data.counts.orders_active >= 0}
              />
              <Row
                label="Ожидают оплаты"
                value={data.counts.orders_pending_payment}
                ok={data.counts.orders_pending_payment === 0}
              />
              <Row label="Пользователей" value={data.counts.users_total} />
              {data.counts.users_online !== null && (
                <Row label="Онлайн сейчас" value={data.counts.users_online} />
              )}
              <Row label="Услуг активных" value={`${data.counts.products_active} / ${data.counts.products_total}`} />
            </Card>
          )}

          {/* Env */}
          {data.env && (
            <Card title="⚙️ Переменные окружения">
              {Object.entries(data.env).map(([key, val]) => (
                <Row
                  key={key}
                  label={key}
                  value={val ? 'Настроено' : 'Не задано'}
                  ok={val}
                  mono
                />
              ))}
            </Card>
          )}

        </div>
      )}
    </div>
  )
}
