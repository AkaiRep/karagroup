import Link from 'next/link'

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@karashop.ru'
const MANAGER = process.env.NEXT_PUBLIC_MANAGER || ''
const CHANNEL = process.env.NEXT_PUBLIC_BOT_CHANNEL || ''
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK || ''

export const metadata = {
  title: 'Контакты',
  description: 'Свяжитесь с поддержкой KaraShop: Telegram, email. Работаем ежедневно с 10:00 до 22:00 МСК.',
  alternates: { canonical: '/contacts' },
}

function ContactCard({ icon, title, subtitle, href, external = false }) {
  const inner = (
    <div className="flex items-center gap-4 bg-[#111318] border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-colors group">
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{title}</div>
        <div className="text-white font-medium truncate group-hover:text-green-400 transition-colors">{subtitle}</div>
      </div>
      <svg className="w-4 h-4 text-slate-600 group-hover:text-green-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )

  if (external) return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  return <Link href={href}>{inner}</Link>
}

export default function ContactsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Контакты</h1>
        <p className="text-slate-400">Мы всегда на связи — выберите удобный способ</p>
      </div>

      <div className="space-y-6 mb-10">

        {/* Support */}
        <div>
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Поддержка</h2>
          <div className="space-y-2">
            {MANAGER && (
              <ContactCard
                icon="💬"
                title="Написать в Telegram"
                subtitle={MANAGER}
                href={`https://t.me/${MANAGER.replace('@', '')}`}
                external
              />
            )}
            <ContactCard
              icon="✉️"
              title="Написать на почту"
              subtitle={EMAIL}
              href={`mailto:${EMAIL}`}
              external
            />
          </div>
        </div>

        {/* Socials */}
        {(CHANNEL || TIKTOK) && (
          <div>
            <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Социальные сети</h2>
            <div className="space-y-2">
              {CHANNEL && (
                <ContactCard
                  icon="📢"
                  title="Telegram-канал"
                  subtitle="Новости и обновления"
                  href={CHANNEL}
                  external
                />
              )}
              {TIKTOK && (
                <ContactCard
                  icon="🎵"
                  title="TikTok"
                  subtitle={TIKTOK.startsWith('@') ? TIKTOK : `@${TIKTOK}`}
                  href={`https://tiktok.com/@${TIKTOK.replace('@', '')}`}
                  external
                />
              )}
            </div>
          </div>
        )}

      </div>

      <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
        <h2 className="font-semibold mb-1">Время работы поддержки</h2>
        <p className="text-slate-400 text-sm">Ежедневно с 10:00 до 22:00 МСК</p>
        <p className="text-slate-500 text-xs mt-2">Среднее время ответа — до 30 минут</p>
      </div>
    </div>
  )
}
