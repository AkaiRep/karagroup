import Link from 'next/link'

const CHANNEL = process.env.NEXT_PUBLIC_BOT_CHANNEL || ''
const MANAGER = process.env.NEXT_PUBLIC_MANAGER || ''

const cols = [
  {
    title: 'Сервис',
    links: [
      { href: '/', label: 'Каталог услуг' },
      { href: '/blog', label: 'Блог' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contacts', label: 'Контакты' },
    ],
  },
  {
    title: 'Покупателям',
    links: [
      { href: '/orders', label: 'Мои заказы' },
      { href: '/refunds', label: 'Возврат средств' },
      { href: '/offer', label: 'Публичная оферта' },
      { href: '/sitemap-page', label: 'Карта сайта' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/5 bg-[#07080d] mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="text-xl font-bold text-green-400 tracking-tight">
              KaraShop
            </Link>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed max-w-xs">
              Профессиональный буст игровых аккаунтов. Быстро, безопасно, с гарантией результата.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {MANAGER && (
                <a
                  href={`https://t.me/${MANAGER.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram"
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-green-500/15 border border-white/5 hover:border-green-500/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247-2.04 9.607c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z"/>
                  </svg>
                </a>
              )}
              {CHANNEL && (
                <a
                  href={CHANNEL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram-канал"
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-green-500/15 border border-white/5 hover:border-green-500/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Nav columns */}
          {cols.map(({ title, links }) => (
            <div key={title}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{title}</p>
              <ul className="space-y-2.5">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-600">© {year} KaraShop. Все права защищены.</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Оплата через</span>
              <img src="/lava.png" alt="Lava" className="h-5 object-contain opacity-60" />
            </div>
            <a href="/sitemap.xml" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono">sitemap.xml</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
