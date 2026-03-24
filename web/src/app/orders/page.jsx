'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import OrderCard from '@/components/OrderCard'

export default function OrdersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState([])
  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const autoChecked = useRef(false)

  const loadOrders = useCallback(() => {
    return api.getMyOrders().then(setOrders).catch((err) => {
      const s = err?.response?.status
      if (s === 401 || s === 403) router.push('/')
      else setFetchError(true)
    })
  }, [])

  useEffect(() => {
    if (!loading && !user) { router.push('/'); return }
    if (user) loadOrders().finally(() => setFetching(false))
  }, [user, loading])

  // Auto-check when coming back from Lava (?lava=ORDER_ID)
  useEffect(() => {
    const lavaOrderId = searchParams.get('lava')
    if (!lavaOrderId || autoChecked.current || !user || loading) return
    autoChecked.current = true
    setChecking(true)
    api.checkSingleLavaPayment(lavaOrderId)
      .then(async (res) => {
        if (res.updated) {
          await loadOrders()
          setCheckResult('paid')
        } else {
          setCheckResult('none')
        }
      })
      .catch(() => setCheckResult('none'))
      .finally(() => setChecking(false))
    // Clean up URL
    router.replace('/orders', { scroll: false })
  }, [searchParams, user, loading])

  const handleCheckLava = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await api.checkLavaPayments()
      setCheckResult(res.updated?.length > 0 ? 'paid_multi' : 'none')
      if (res.updated?.length > 0) await loadOrders()
    } catch (e) {
      setCheckResult('error')
    } finally {
      setChecking(false)
    }
    setTimeout(() => setCheckResult(null), 5000)
  }

  const resultLabel = () => {
    if (checkResult === 'paid') return '✓ Оплата подтверждена!'
    if (checkResult === 'paid_multi') return '✓ Оплата подтверждена!'
    if (checkResult === 'none') return 'Новых оплат нет'
    if (checkResult === 'error') return 'Ошибка проверки'
    return 'Проверить оплату'
  }

  if (!loading && user && !user.telegram_id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Telegram не привязан</h2>
        <p className="text-slate-400 text-sm mb-6">Для просмотра заказов необходимо привязать Telegram аккаунт</p>
        <a href="/profile" className="inline-block px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-semibold transition-colors text-sm">
          Привязать Telegram
        </a>
      </div>
    )
  }

  if (loading || fetching) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#111318] rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center py-20">
        <p className="text-slate-400">Не удалось загрузить заказы. Попробуйте обновить страницу.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Мои заказы</h1>
        <button
          onClick={handleCheckLava}
          disabled={checking}
          className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-all disabled:opacity-50 ${
            checkResult === 'paid' || checkResult === 'paid_multi'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : checkResult === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-[#111318] border-white/10 hover:border-green-500/30 text-slate-400 hover:text-green-400'
          }`}
        >
          <svg
            className={`w-4 h-4 flex-shrink-0 ${checking ? 'animate-spin' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {checking ? 'Проверяем...' : resultLabel()}
        </button>
      </div>

      {checkResult === 'paid' && (
        <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
          Оплата найдена, заказ переведён в работу!
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <p className="text-slate-400">У вас пока нет заказов</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
