import Link from 'next/link'
import Image from 'next/image'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const metadata = {
  title: 'Блог',
  description: 'Статьи и гайды о буст-услугах KaraShop: советы по игровому бусту, гайды по рангам и многое другое.',
  alternates: { canonical: '/blog' },
}

async function getPosts() {
  try {
    const res = await fetch(`${API_URL}/blog/`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Блог</h1>
        <p className="text-slate-400">Статьи и гайды об игровом буст-сервисе</p>
      </div>

      {posts.length === 0 && (
        <p className="text-slate-500 text-center py-16">Статьи скоро появятся</p>
      )}

      <div className="space-y-4">
        {posts.map(post => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="block group">
            <article className="bg-[#111318] border border-white/5 hover:border-green-500/20 rounded-2xl overflow-hidden transition-colors">
              {post.cover_image_url && (
                <div className="relative w-full h-48">
                  <Image
                    src={post.cover_image_url}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 768px"
                  />
                </div>
              )}
              <div className="p-6">
                <time className="text-xs text-slate-500 mb-2 block">{formatDate(post.created_at)}</time>
                <h2 className="text-lg font-semibold text-white group-hover:text-green-400 transition-colors mb-2">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
                )}
                <span className="inline-block mt-4 text-xs text-green-400 group-hover:text-green-300 transition-colors">
                  Читать далее →
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  )
}
