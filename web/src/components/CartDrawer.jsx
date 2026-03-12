'use client'
import { useState } from 'react'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import TelegramLoginButton from '@/components/TelegramLoginButton'

export default function CartDrawer({ open, onClose }) {
  const { cart, promo, setPromo, removeItem, clearCart, total, finalTotal, count } = useCart()
  const { user } = useAuth()
  const [promoInput, setPromoInput] = useState('')
  const [promoError, setPromoError] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [checkoutState, setCheckoutState] = useState('idle') // idle | confirm | loading | done | error
  const [paymentUrl, setPaymentUrl] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const items = Object.values(cart)

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
        product_ids: items.map(i => i.id),
        promo_code: promo?.code ?? null,
      }
      const order = await api.createOrder(orderData)
      const payment = await api.createPayment(order.id)
      setPaymentUrl(payment.payment_url)
      clearCart()
      setCheckoutState('done')
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || 'Ошибка при оформлении заказа')
      setCheckoutState('error')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-md bg-[#0d0f15] border-l border-white/5 flex flex-col h-full overflow-hidden">
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
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium text-center transition-colors"
              >
                Перейти к оплате
              </a>
            )}
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Закрыть
            </button>
          </div>
        )}

        {/* Empty */}
        {checkoutState !== 'done' && items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p className="text-slate-400">Корзина пуста</p>
          </div>
        )}

        {/* Items */}
        {checkoutState !== 'done' && items.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.map(item => {
                const disc = item.discount_percent || 0
                const price = item.price * (1 - disc / 100)
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 bg-[#111318] rounded-xl p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug">{item.name}</p>
                      <p className="text-violet-400 text-sm font-semibold mt-1">
                        {price.toLocaleString('ru-RU')} ₽
                        {disc > 0 && (
                          <span className="text-slate-500 font-normal line-through ml-2">
                            {item.price.toLocaleString('ru-RU')} ₽
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
                )
              })}
            </div>

            {/* Promo */}
            <div className="px-5 pb-3">
              {promo ? (
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
                    className="flex-1 bg-[#111318] border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                  <button
                    onClick={applyPromo}
                    disabled={promoLoading}
                    className="px-4 py-2.5 bg-[#111318] border border-white/10 hover:border-violet-500/30 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {promoLoading ? '...' : 'Применить'}
                  </button>
                </div>
              )}
              {promoError && <p className="text-red-400 text-xs mt-2">{promoError}</p>}
            </div>

            {/* Summary */}
            <div className="px-5 py-4 border-t border-white/5 space-y-3">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Итого без скидки</span>
                <span>{total.toLocaleString('ru-RU')} ₽</span>
              </div>
              {promo && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Промокод -{promo.discount_percent}%</span>
                  <span>-{(total - finalTotal).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>К оплате</span>
                <span className="text-violet-400">{finalTotal.toLocaleString('ru-RU')} ₽</span>
              </div>

              {checkoutState === 'error' && (
                <p className="text-red-400 text-sm">{errorMsg}</p>
              )}

              {user ? (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutState === 'loading'}
                  className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                >
                  {checkoutState === 'loading' ? 'Оформляем...' : 'Оформить заказ'}
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
