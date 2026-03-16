import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const metadata = {
  title: 'Карта сайта',
  description: 'Все разделы сайта KaraShop — буст аккаунтов, FAQ, блог, контакты и условия.',
  alternates: { canonical: '/sitemap-page' },
}

async function getBlogPosts() {
  try {
    const res = await fetch(`${API_URL}/blog/`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

const Section = ({ icon, title, links }) => (
  <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl">{icon}</span>
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
    <ul className="space-y-2">
      {links.map(({ href, label, desc }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex items-start gap-3 group"
          >
            <span className="mt-0.5 text-slate-600 group-hover:text-green-400 transition-colors text-xs">→</span>
            <div>
              <span className="text-sm text-slate-300 group-hover:text-green-400 transition-colors font-medium">{label}</span>
              {desc && <p className="text-xs text-slate-600 mt-0.5">{desc}</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  </div>
)

export default async function SitemapPage() {
  const posts = await getBlogPosts()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Карта сайта</h1>
        <p className="text-slate-400">Все разделы и страницы KaraShop</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          icon="🏠"
          title="Главная"
          links={[
            { href: '/', label: 'Главная страница', desc: 'Каталог услуг и информация о сервисе' },
            { href: '/orders', label: 'Мои заказы', desc: 'История и статус ваших заказов' },
          ]}
        />

        <Section
          icon="📖"
          title="Блог"
          links={[
            { href: '/blog', label: 'Все статьи', desc: 'Гайды и советы по игровому бусту' },
            ...posts.slice(0, 5).map(p => ({
              href: `/blog/${p.slug}`,
              label: p.title,
              desc: p.excerpt?.slice(0, 60) || undefined,
            })),
          ]}
        />

        <Section
          icon="💬"
          title="Поддержка"
          links={[
            { href: '/faq', label: 'Частые вопросы', desc: 'Ответы на популярные вопросы' },
            { href: '/contacts', label: 'Контакты', desc: 'Telegram, email и время работы поддержки' },
          ]}
        />

        <Section
          icon="📄"
          title="Документы"
          links={[
            { href: '/refunds', label: 'Условия возврата', desc: 'Порядок и сроки возврата средств' },
            { href: '/offer', label: 'Публичная оферта', desc: 'Договор об оказании услуг' },
          ]}
        />
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-slate-600">
        <span>Для поисковых систем:</span>
        <a href="/sitemap.xml" className="text-green-500/60 hover:text-green-400 transition-colors font-mono">
          /sitemap.xml
        </a>
      </div>
    </div>
  )
}
