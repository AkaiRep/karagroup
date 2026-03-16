import { notFound } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://karashop.ru'

async function getPost(slug) {
  try {
    const res = await fetch(`${API_URL}/blog/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt || post.content.slice(0, 160),
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt || post.content.slice(0, 160),
      ...(post.cover_image_url && { images: [{ url: post.cover_image_url, width: 1200, height: 630 }] }),
    },
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPostPage({ params }) {
  const post = await getPost(params.slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || post.content.slice(0, 160),
    datePublished: post.created_at,
    dateModified: post.updated_at,
    publisher: { '@type': 'Organization', name: 'KaraShop', url: SITE_URL },
    ...(post.cover_image_url && { image: post.cover_image_url }),
  }

  const paragraphs = post.content.split(/\n\n+/).filter(Boolean)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/blog" className="text-sm text-slate-500 hover:text-green-400 transition-colors mb-8 inline-block">
          ← Назад к блогу
        </Link>

        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-64 object-cover rounded-2xl mb-8"
          />
        )}

        <time className="text-xs text-slate-500 mb-3 block">{formatDate(post.created_at)}</time>
        <h1 className="text-3xl font-bold mb-8">{post.title}</h1>

        <div className="prose-custom space-y-4 text-slate-300 leading-relaxed">
          {paragraphs.map((para, i) => (
            <p key={i}>{para.split('\n').map((line, j) => (
              <span key={j}>{line}{j < para.split('\n').length - 1 && <br />}</span>
            ))}</p>
          ))}
        </div>
      </div>
    </>
  )
}
