'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import TelegramLoginButton from '@/components/TelegramLoginButton'

export default function CartDrawer({ open, onClose }) {
  const { cart, promo, setPromo, removeItem, setQty, clearCart, baseTotal, total, finalTotal, count, globalDiscount, effectiveDiscount, hasPinnedItems } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [promoInput, setPromoInput] = useState('')
  const [promoError, setPromoError] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [checkoutState, setCheckoutState] = useState('idle') // idle | loading | method | paying | done | error
  const [paymentUrl, setPaymentUrl] = useState(null)
  const [pendingOrderId, setPendingOrderId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const items = Object.values(cart)

  // Блокировка скролла страницы когда корзина открыта
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])


  const applyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const data = await api.lookupPromo(promoInput.trim())
      setPromo(data)
    } catch {
      setPromoError('Промокод не найден или неактивен')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!user) return
    setCheckoutState('loading')
    setErrorMsg('')
    try {
      const orderData = {
        items: items.map(i => ({ product_id: i.id, quantity: i.quantity || 1, discount: effectiveDiscount(i) })),
        price: Math.round(total * 100) / 100,
        promo_code: promo?.code ?? null,
      }
      const order = await api.createOrder(orderData)
      setPendingOrderId(order.id)
      clearCart()
      setCheckoutState('method')
    } catch (e) {
      console.error('Checkout error:', e?.response?.data || e?.message || e)
      setErrorMsg(e?.response?.data?.detail || 'Ошибка при оформлении заказа')
      setCheckoutState('error')
    }
  }

  const handlePayMethod = async (payload) => {
    setCheckoutState('paying')
    try {
      const payment = await api.createPayment(pendingOrderId, payload)
      setPaymentUrl(payment.payment_url)
      setCheckoutState('done')
    } catch (e) {
      setErrorMsg('Ошибка при создании платежа')
      setCheckoutState('error')
    }
  }

  const handleCancelOrder = async () => {
    try {
      await api.cancelOrder(pendingOrderId)
    } catch {}
    setPendingOrderId(null)
    setCheckoutState('idle')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-md bg-[#0d0f15] border-l border-white/5 flex flex-col h-[100dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold">
            Корзина {count > 0 && <span className="text-slate-400 font-normal text-base">({count})</span>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error state (after order created but payment failed) */}
        {checkoutState === 'error' && pendingOrderId && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-1">Ошибка оплаты</h3>
              <p className="text-slate-400 text-sm">{errorMsg || 'Не удалось создать платёж'}</p>
            </div>
            <button
              onClick={() => setCheckoutState('method')}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors"
            >
              Попробовать снова
            </button>
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Закрыть
            </button>
          </div>
        )}

        {/* Method selection */}
        {(checkoutState === 'method' || checkoutState === 'paying') && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-1">Заказ создан!</h3>
              <p className="text-slate-400 text-sm">Выберите способ оплаты</p>
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={() => handlePayMethod({ provider: 'lava' })}
                disabled={checkoutState === 'paying'}
                className="w-full py-3.5 bg-[#111318] border border-white/10 hover:border-[#FF6B2B]/40 hover:bg-[#FF6B2B]/5 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <img src="/lava.png" alt="LAVA" className="h-5 object-contain" />
                <span>LAVA — Карта, СБП, Крипта</span>
              </button>
              <button
                onClick={() => handlePayMethod({ payment_method: 2 })}
                disabled={checkoutState === 'paying'}
                className="w-full py-3.5 bg-[#111318] border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <span className="text-xl">⚡</span>
                <span>СБП — Система быстрых платежей</span>
              </button>
              <button
                onClick={() => handlePayMethod({ payment_method: 11 })}
                disabled={checkoutState === 'paying'}
                className="w-full py-3.5 bg-[#111318] border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <span className="text-xl">💳</span>
                <span>Карта РФ</span>
              </button>
              <button
                onClick={() => handlePayMethod({ payment_method: 12 })}
                disabled={checkoutState === 'paying'}
                className="w-full py-3.5 bg-[#111318] border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <span className="text-xl">🌍</span>
                <span>Международная карта</span>
              </button>
            </div>
            {checkoutState === 'paying' && <p className="text-slate-500 text-sm">Создаём ссылку на оплату...</p>}
            {checkoutState === 'method' && (
              <button
                onClick={handleCancelOrder}
                className="text-sm text-slate-500 hover:text-red-400 transition-colors"
              >
                Отменить заказ
              </button>
            )}
          </div>
        )}

        {/* Done state */}
        {checkoutState === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Заказ создан!</h3>
              <p className="text-slate-400 text-sm">Перейдите по ссылке для оплаты</p>
            </div>
            {paymentUrl && (
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { onClose(); router.push('/orders') }}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium text-center transition-colors"
              >
                Перейти к оплате
              </a>
            )}
            <button
              onClick={() => { onClose(); router.push('/orders') }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Мои заказы
            </button>
            <button
              onClick={handleCancelOrder}
              className="text-sm text-slate-500 hover:text-red-400 transition-colors"
            >
              Отменить заказ
            </button>
          </div>
        )}

        {/* Empty */}
        {checkoutState !== 'done' && !(checkoutState === 'error' && pendingOrderId) && items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p className="text-slate-400">Корзина пуста</p>
          </div>
        )}

        {/* Items */}
        {checkoutState !== 'done' && !(checkoutState === 'error' && pendingOrderId) && items.length > 0 && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              {items.map(item => {
                const disc = effectiveDiscount(item)
                const unitPrice = item.price * (1 - disc / 100)
                const qty = item.quantity || 1
                return (
                  <div key={item.id} className="bg-[#111318] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-snug">{item.name}</p>
                        <p className="text-green-400 text-sm font-semibold mt-1">
                          {(unitPrice * qty).toLocaleString('ru-RU')} ₽
                          {qty > 1 && (
                            <span className="text-slate-500 font-normal ml-1 text-xs">
                              ({unitPrice.toLocaleString('ru-RU')} ₽ × {qty})
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => setQty(item.id, qty - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-[#0d0f15] hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-lg transition-colors"
                      >−</button>
                      <span className="w-8 text-center text-sm font-semibold text-green-400">{qty}</span>
                      <button
                        onClick={() => setQty(item.id, qty + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-[#0d0f15] hover:bg-green-500/20 hover:text-green-400 text-slate-400 rounded-lg transition-colors"
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Promo */}
            <div className="px-5 pb-3">
              {hasPinnedItems ? (
                <p className="text-xs text-slate-500 text-center py-1">Промокод недоступен для товаров этой категории</p>
              ) : promo ? (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-green-400 text-sm font-medium">{promo.code}</p>
                    <p className="text-xs text-green-400/70">Скидка {promo.discount_percent}%</p>
                  </div>
                  <button onClick={() => { setPromo(null); setPromoInput('') }} className="text-slate-500 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value); setPromoError('') }}
                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                    placeholder="Промокод"
                    className="flex-1 bg-[#111318] border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-green-500/50 transition-colors"
                  />
                  <button
                    onClick={applyPromo}
                    disabled={promoLoading}
                    className="px-4 py-2.5 bg-[#111318] border border-white/10 hover:border-green-500/30 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {promoLoading ? '...' : 'Применить'}
                  </button>
                </div>
              )}
              {promoError && <p className="text-red-400 text-xs mt-2">{promoError}</p>}
            </div>

            {/* Summary */}
            <div className="px-5 py-4 border-t border-white/5 space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Сумма</span>
                <span>{baseTotal.toLocaleString('ru-RU')} ₽</span>
              </div>
              {total < baseTotal && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Скидка</span>
                  <span>-{(baseTotal - total).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
                </div>
              )}
              {promo && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Промокод -{promo.discount_percent}%</span>
                  <span>-{(total - finalTotal).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-1 border-t border-white/5">
                <span>К оплате</span>
                <span className="text-green-400">{finalTotal.toLocaleString('ru-RU')} ₽</span>
              </div>

              {checkoutState === 'error' && !pendingOrderId && (
                <p className="text-red-400 text-sm">{errorMsg}</p>
              )}

              {user ? (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutState === 'loading'}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                >
                  {checkoutState === 'loading' ? 'Создаём заказ...' : 'Оформить заказ'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-400 text-center">Войдите для оформления заказа</p>
                  <div className="flex justify-center">
                    <TelegramLoginButton />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
