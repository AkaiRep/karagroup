import axios from 'axios'

export const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: BASE })

client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const api = {
  // Auth
  telegramAuth: (data) => client.post('/auth/telegram', data).then(r => r.data),
  telegramWebAppAuth: (initData) => client.post('/auth/telegram-webapp', { init_data: initData }).then(r => r.data),
  getMe: () => client.get('/auth/me').then(r => r.data),
  register: (username, password) => client.post('/auth/register', { username, password }).then(r => r.data),
  loginWithPassword: (username, password) => client.post('/auth/login', { username, password }).then(r => r.data),
  generateTelegramLinkToken: () => client.post('/auth/telegram-link-token').then(r => r.data),
  checkTelegramLink: () => client.get('/auth/check-telegram-link').then(r => r.data),

  // Catalog
  getCategories: () => client.get('/categories/').then(r => r.data),
  getProducts: (activeOnly = true) => client.get('/products/', { params: { active_only: activeOnly } }).then(r => r.data),
  getGlobalDiscount: () => client.get('/products/global-discount').then(r => r.data),
  lookupPromo: (code) => client.get(`/media/promo-codes/lookup/${code}`).then(r => r.data),

  // Orders
  getRecentOrders: () => client.get('/orders/recent').then(r => r.data),
  createOrder: (data) => client.post('/orders/', data).then(r => r.data),
  cancelOrder: (orderId) => client.post(`/orders/${orderId}/cancel`).then(r => r.data),
  getMyOrders: () => client.get('/orders/', { params: { exclude_status: 'pending_payment' } }).then(r => r.data),

  // Payments
  createPayment: (orderId, payload) => {
    if (typeof payload === 'number') payload = { payment_method: payload }
    return client.post(`/payments/create/${orderId}`, payload || {}).then(r => r.data)
  },

  // Site settings
  getSiteSettings: () => client.get('/site-settings/').then(r => r.data),

  // Reviews
  getReviews: () => client.get('/reviews/').then(r => r.data),

  // Blog
  getBlogPosts: () => client.get('/api/blog/').then(r => r.data),

  // Blog social
  getBlogSocial: (slug) => client.get(`/api/blog/${slug}/social`).then(r => r.data),
  incrementView: (slug) => client.post(`/api/blog/${slug}/view`).then(r => r.data),
  toggleLike: (slug) => client.post(`/api/blog/${slug}/like`).then(r => r.data),
  addComment: (slug, text, parentId = null) => client.post(`/api/blog/${slug}/comments`, { text, parent_id: parentId }).then(r => r.data),
}
