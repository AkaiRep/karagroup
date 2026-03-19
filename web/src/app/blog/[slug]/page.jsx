import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import BlogInteractions from '@/components/BlogInteractions'

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://karashop.ru'

async function getPost(slug) {
  try {
    const res = await fetch(`${API_URL}/api/blog/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function getRelatedPosts(currentSlug) {
  try {
    const res = await fetch(`${API_URL}/api/blog/`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const posts = await res.json()
    const others = posts.filter(p => p.slug !== currentSlug)
    // shuffle and take 3
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]]
    }
    return others.slice(0, 3)
  } catch {
    return []
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.slug)
  if (!post) return {}
  const contentPreview = stripHtml(post.content).slice(0, 80).trimEnd()
  const description = post.excerpt
    ? `${post.excerpt} — ${contentPreview}...`
    : `${contentPreview}...`
  const pageUrl = `${SITE_URL}/blog/${post.slug}`
  const imageUrl = post.cover_image_url
    ? post.cover_image_url.startsWith('http')
      ? post.cover_image_url
      : `${API_URL}${post.cover_image_url}`
    : `${SITE_URL}/favpic.png`
  return {
    title: `${post.title} — KaraShop Блог`,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'article',
      url: pageUrl,
      title: `${post.title} — KaraShop Блог`,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} — KaraShop Блог`,
      description,
      images: [imageUrl],
    },
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPostPage({ params }) {
  const [post, related] = await Promise.all([getPost(params.slug), getRelatedPosts(params.slug)])
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || stripHtml(post.content).slice(0, 160),
    datePublished: post.created_at,
    dateModified: post.updated_at,
    publisher: { '@type': 'Organization', name: 'KaraShop', url: SITE_URL },
    ...(post.cover_image_url && { image: post.cover_image_url }),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Блог', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/blog" className="text-sm text-slate-500 hover:text-green-400 transition-colors mb-8 inline-block">
          ← Назад к блогу
        </Link>

        {post.cover_image_url && (
          <div className="relative w-full h-64 rounded-2xl overflow-hidden mb-8">
            <Image
              src={post.cover_image_url.startsWith('http') ? post.cover_image_url : `${API_URL}${post.cover_image_url}`}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
          </div>
        )}

        <time className="text-xs text-slate-500 mb-3 block">{formatDate(post.created_at)}</time>
        <h1 className="text-3xl font-bold mb-8">{post.title}</h1>

        <div
          className="blog-content text-slate-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mt-12 pt-8 border-t border-white/8">
            <h3 className="text-base font-semibold text-slate-200 mb-4">Читайте также</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {related.map(p => (
                <a
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group bg-[#111318] border border-white/5 rounded-xl overflow-hidden hover:border-green-500/30 transition-all duration-200 flex flex-col"
                >
                  {p.cover_image_url && (
                    <div className="h-28 overflow-hidden">
                      <img
                        src={p.cover_image_url.startsWith('http') ? p.cover_image_url : `${API_URL.replace(/\/$/, '')}${p.cover_image_url.startsWith('/') ? p.cover_image_url : '/' + p.cover_image_url}`}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="text-xs font-medium text-white group-hover:text-green-300 transition-colors leading-snug flex-1">
                      {p.title}
                    </p>
                    <span className="mt-2 text-xs text-green-400/70 group-hover:text-green-400 transition-colors">Читать →</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <BlogInteractions slug={post.slug} />
      </div>
    </>
  )
}
