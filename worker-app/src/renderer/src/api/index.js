import axios from 'axios'

const DEFAULT_SERVER = 'http://localhost:8000'

export const getApiBase = () =>
  (localStorage.getItem('serverUrl') || DEFAULT_SERVER).replace(/\/+$/, '')

// For image URL construction (called as function in JSX)
export const API_BASE = getApiBase

const api = axios.create()

api.interceptors.request.use((config) => {
  config.baseURL = getApiBase()
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)

const wsBase = () => getApiBase().replace(/^http/, 'ws')

export const login = async (username, password) => {
  const version = await window.electronBridge?.getVersion().catch(() => null)
  return api.post('/auth/login', { username, password, version }).then((r) => r.data)
}
let _cachedVersion = null
const getVersion = async () => {
  if (_cachedVersion !== null) return _cachedVersion
  _cachedVersion = await window.electronBridge?.getVersion().catch(() => '') || ''
  return _cachedVersion
}

export const sendHeartbeat = async () => {
  const version = await getVersion()
  return api.post('/users/heartbeat', null, { headers: { 'X-Worker-Version': version } })
}

export const checkScreenshotPending = () =>
  api.get('/users/screenshot/pending').then((r) => r.data)


export const uploadProcesses = (processes) =>
  api.post('/users/processes', { processes })

export const checkKillPending = () =>
  api.get('/users/processes/kill-pending').then((r) => r.data)

export const fetchCommandsPending = () =>
  api.get('/users/commands/pending').then((r) => r.data)

export const uploadWorkerScreenshot = (base64) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  const fd = new FormData()
  fd.append('file', blob, 'screenshot.jpg')
  return api.post('/users/screenshot', fd)
}

export const getAvailableOrders = () => api.get('/orders/available').then((r) => r.data)
export const getMyOrders = () =>
  api.get('/orders/', { params: { status: 'in_progress' } }).then((r) => r.data)
export const getAllMyOrders = () =>
  api.get('/orders/', { params: { exclude_status: 'paid' } }).then((r) => r.data)
export const takeOrder = (id) => api.post(`/orders/${id}/take`).then((r) => r.data)
export const completeOrder = (id) =>
  api.patch(`/orders/${id}/status`, { status: 'completed' }).then((r) => r.data)

export const getMessages = (orderId) =>
  api.get(`/chat/${orderId}/messages`).then((r) => r.data)
export const sendMessage = (orderId, content) =>
  api.post(`/chat/${orderId}/messages`, { content }).then((r) => r.data)
export const uploadChatImage = (orderId, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/chat/${orderId}/upload-image`, form).then((r) => r.data)
}
export const getUnreadCounts = () =>
  api.get('/chat/unread-counts').then((r) => r.data)
export const markChatRead = (orderId) =>
  api.post(`/chat/${orderId}/read`).then((r) => r.data)
export const createChatWs = (orderId) => {
  const token = localStorage.getItem('token')
  return new WebSocket(`${wsBase()}/chat/ws/${orderId}?token=${token}`)
}

export const getMyTransactions = () =>
  api.get('/financial/transactions').then((r) => r.data)

// ── Global Chat ───────────────────────────────────────────────────────────────
export const getGlobalMessages = () =>
  api.get('/global-chat/messages').then((r) => r.data)
export const sendGlobalMessage = (content) =>
  api.post('/global-chat/messages', { content }).then((r) => r.data)
export const uploadGlobalImage = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/global-chat/upload-image', form).then((r) => r.data)
}
export const getGlobalUnreadCount = (since) =>
  api.get('/global-chat/unread-count', { params: since ? { since } : {} }).then((r) => r.data)
export const createGlobalChatWs = () => {
  const token = localStorage.getItem('token')
  return new WebSocket(`${wsBase()}/global-chat/ws?token=${token}`)
}

// ── Teleports ──────────────────────────────────────────────────────────────
export const getTeleportGroups = () => api.get('/teleports/groups').then(r => r.data)
export const getTeleportPresets = (groupId) => api.get(`/teleports/groups/${groupId}/presets`).then(r => r.data)
export const downloadTeleportPreset = (presetId) =>
  api.get(`/teleports/presets/${presetId}/download`, { responseType: 'arraybuffer' }).then(r => r.data)
