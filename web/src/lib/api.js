import axios from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

  // Catalog
  getCategories: () => client.get('/categories/').then(r => r.data),
  getProducts: (activeOnly = true) => client.get('/products/', { params: { active_only: activeOnly } }).then(r => r.data),
  getGlobalDiscount: () => client.get('/products/global-discount').then(r => r.data),
  lookupPromo: (code) => client.get(`/media/promo-codes/lookup/${code}`).then(r => r.data),

  // Orders
  createOrder: (data) => client.post('/orders/', data).then(r => r.data),
  getMyOrders: (telegramUserId) => client.get('/orders/', { params: { telegram_user_id: telegramUserId } }).then(r => r.data),

  // Payments
  createPayment: (orderId) => client.post(`/payments/create/${orderId}`).then(r => r.data),

  // Reviews
  getReviews: () => client.get('/reviews/').then(r => r.data),
}
