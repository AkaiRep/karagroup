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

function SitemapGroup({ label, color, items }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <ul className="space-y-1">
        {items.map(({ href, label: name, desc }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-[#111318] border border-white/[0.04] hover:border-green-500/20 hover:bg-green-500/[0.03] transition-all"
            >
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-700 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="min-w-0">
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors font-medium leading-none">
                  {name}
                </span>
                {desc && (
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{desc}</p>
                )}
              </div>
              <span className="ml-auto text-xs text-slate-700 group-hover:text-slate-500 transition-colors font-mono flex-shrink-0 pt-0.5">
                {href}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function SitemapPage() {
  const posts = await getBlogPosts()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          KaraShop
        </div>
        <h1 className="text-3xl font-bold mb-2">Карта сайта</h1>
        <p className="text-slate-400">Все страницы и разделы сайта в одном месте</p>
      </div>

      <div className="space-y-8">
        <SitemapGroup
          label="Основное"
          color="bg-green-400"
          items={[
            { href: '/', label: 'Главная', desc: 'Каталог буст-услуг' },
            { href: '/orders', label: 'Мои заказы', desc: 'История и статус заказов' },
          ]}
        />

        <SitemapGroup
          label="Блог"
          color="bg-blue-400"
          items={[
            { href: '/blog', label: 'Все статьи', desc: 'Гайды и советы по игровому бусту' },
            ...posts.slice(0, 6).map(p => ({
              href: `/blog/${p.slug}`,
              label: p.title,
              desc: p.excerpt?.slice(0, 70) || undefined,
            })),
          ]}
        />

        <SitemapGroup
          label="Поддержка"
          color="bg-yellow-400"
          items={[
            { href: '/faq', label: 'Частые вопросы', desc: 'Ответы на популярные вопросы' },
            { href: '/contacts', label: 'Контакты', desc: 'Telegram, email и время работы' },
          ]}
        />

        <SitemapGroup
          label="Документы"
          color="bg-slate-400"
          items={[
            { href: '/refunds', label: 'Возврат средств', desc: 'Порядок и сроки возврата' },
            { href: '/offer', label: 'Публичная оферта', desc: 'Договор об оказании услуг' },
          ]}
        />
      </div>

      <div className="mt-10 p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">XML-карта для поисковых систем</p>
          <p className="text-xs text-slate-600 mt-0.5">Яндекс, Google и другие роботы используют этот файл</p>
        </div>
        <a
          href="/sitemap.xml"
          className="text-xs font-mono text-green-400 hover:text-green-300 transition-colors bg-green-500/10 hover:bg-green-500/15 px-3 py-1.5 rounded-lg border border-green-500/20"
        >
          sitemap.xml →
        </a>
      </div>
    </div>
  )
}
