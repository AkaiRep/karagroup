'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < rating ? 'text-yellow-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function ReviewCard({ review }) {
  return (
    <div className="flex-shrink-0 w-72 md:w-80 bg-[#111318] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/20 flex items-center justify-center text-green-400 font-semibold text-sm">
            F
          </div>
          <div>
            <p className="text-sm font-medium leading-none">Покупатель</p>
            {review.date_str && <p className="text-xs text-slate-500 mt-0.5">{review.date_str}</p>}
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>

      <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">{review.text}</p>

      {review.game && (
        <span className="text-xs text-green-400/70 font-medium">{review.game}</span>
      )}
    </div>
  )
}

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState([])

  useEffect(() => {
    api.getReviews().then(setReviews).catch(() => {})
  }, [])

  if (reviews.length === 0) return null

  const doubled = [...reviews, ...reviews]
  const duration = Math.max(reviews.length * 5, 30)

  return (
    <section className="py-14 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">Отзывы покупателей</h2>
        <p className="text-slate-400 mt-1 text-sm md:text-base">Реальные отзывы с FunPay</p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#07080d] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#07080d] to-transparent z-10 pointer-events-none" />

        <div
          className="flex gap-4 carousel-track"
          style={{ width: 'max-content', '--carousel-duration': `${duration}s` }}
        >
          {doubled.map((review, i) => (
            <ReviewCard key={i} review={review} />
          ))}
        </div>
      </div>
    </section>
  )
}
