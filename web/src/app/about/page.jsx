'use client'

export default function AboutPage() {
  const channel = process.env.NEXT_PUBLIC_BOT_CHANNEL
  const manager = process.env.NEXT_PUBLIC_MANAGER

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">О нас</h1>

      <div className="space-y-6">
        <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-3 text-green-400">Кто мы</h2>
          <p className="text-slate-400 leading-relaxed">
            KaraShop — профессиональный сервис буста игровых аккаунтов. Мы работаем с опытными игроками,
            которые помогут вам достичь желаемого ранга быстро и безопасно.
          </p>
        </div>

        <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-green-400">Наши гарантии</h2>
          <ul className="space-y-3">
            {[
              'Безопасность аккаунта — работаем с использованием VPN',
              'Гарантия результата или возврат средств',
              'Оперативное выполнение заказов',
              'Поддержка 24/7 в Telegram',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-300">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-green-400">Контакты</h2>
          <div className="space-y-3">
            {channel && (
              <a
                href={channel}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-[#229ED9] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
                </svg>
                Наш Telegram-канал
              </a>
            )}
            {manager && (
              <a
                href={`https://t.me/${manager.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-[#229ED9] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                Написать менеджеру: {manager}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
