import { useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useChatStore, useGlobalChatStore } from '../store'
import { getUnreadCounts, getGlobalUnreadCount, sendHeartbeat } from '../api'
import { playSound } from '../utils/sound'

const nav = [
  { to: '/dashboard', label: 'Дашборд', icon: '📊' },
  { to: '/orders', label: 'Заказы', icon: '📋' },
  { to: '/products', label: 'Услуги', icon: '🎮' },
  { to: '/workers', label: 'Качеры', icon: '👷' },
  { to: '/financial', label: 'Финансы', icon: '💰' },
  { to: '/media', label: 'Медиа', icon: '📺' },
  { to: '/settings', label: 'Настройки', icon: '⚙️' },
  { to: '/health', label: 'Здоровье', icon: '🩺' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { applyNewCounts } = useChatStore()
  const { unread: globalUnread, setUnread: setGlobalUnread, isOpen: globalIsOpen } = useGlobalChatStore()
  const navigate = useNavigate()

  const isFirstMsgPoll = useRef(true)
  const isFirstGlobalPoll = useRef(true)
  const prevGlobalCount = useRef(0)

  // Heartbeat — keep online status alive
  useEffect(() => {
    sendHeartbeat().catch(() => {})
    const interval = setInterval(() => sendHeartbeat().catch(() => {}), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Background: order chat notifications
  useEffect(() => {
    const poll = async () => {
      try {
        const counts = await getUnreadCounts()
        const hasNew = applyNewCounts(counts)
        if (!isFirstMsgPoll.current && hasNew) playSound('message')
      } catch {}
      isFirstMsgPoll.current = false
    }
    poll()
    const interval = setInterval(poll, 5_000)
    return () => clearInterval(interval)
  }, [])

  // Background: global chat notifications
  useEffect(() => {
    const poll = async () => {
      try {
        const since = localStorage.getItem('globalChatLastSeen')
        const { count } = await getGlobalUnreadCount(since)

        if (!isFirstGlobalPoll.current && count > prevGlobalCount.current && !globalIsOpen) {
          playSound('global')
          setGlobalUnread(count)
        } else if (isFirstGlobalPoll.current) {
          setGlobalUnread(count)
        }
        prevGlobalCount.current = count
      } catch {}
      isFirstGlobalPoll.current = false
    }
    poll()
    const interval = setInterval(poll, 5_000)
    return () => clearInterval(interval)
  }, [globalIsOpen])

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      <aside className="w-56 bg-[#1a1f2e] border-r border-slate-700/50 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700/50">
          <div className="text-xl font-bold text-brand-500">KaraGroup</div>
          <div className="text-xs text-slate-500 mt-0.5">Admin</div>
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* Global chat with unread badge */}
          <NavLink
            to="/global-chat"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
              }`
            }
          >
            <span>💬</span>
            <span className="flex-1">Общий чат</span>
            {globalUnread > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {globalUnread > 99 ? '99+' : globalUnread}
              </span>
            )}
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="text-sm text-slate-400 mb-2 truncate">{user?.username}</div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
