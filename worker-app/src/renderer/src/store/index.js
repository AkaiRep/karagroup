import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,

  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null })
  },
}))

export const useGlobalChatStore = create((set) => ({
  unread: 0,
  isOpen: false,
  setUnread: (n) => set({ unread: n }),
  incrementUnread: () => set((s) => ({ unread: s.unread + 1 })),
  markRead: () => {
    localStorage.setItem('globalChatLastSeen', new Date().toISOString())
    set({ unread: 0 })
  },
  setOpen: (v) => set({ isOpen: v }),
}))

export const useChatStore = create((set, get) => ({
  unread: {},
  activeChatOrderId: null,
  knownCounts: {},

  setActiveChatOrderId: (id) => set({ activeChatOrderId: id }),

  setUnreadCounts: (counts) => set({ unread: counts }),

  applyNewCounts: (counts) => {
    const prev = get().knownCounts
    const active = get().activeChatOrderId
    let hasNew = false

    for (const [orderId, count] of Object.entries(counts)) {
      const prevCount = prev[orderId] || 0
      if (count > prevCount && String(orderId) !== String(active)) {
        hasNew = true
        break
      }
    }

    set({ knownCounts: counts, unread: counts })
    return hasNew
  },

  markRead: (orderId) => {
    const key = String(orderId)
    const currentCount = get().unread[key] || 0
    set((s) => ({
      activeChatOrderId: orderId,
      knownCounts: { ...s.knownCounts, [key]: currentCount },
      unread: { ...s.unread, [key]: 0 },
    }))
  },

  closeChat: () => set({ activeChatOrderId: null }),
}))
