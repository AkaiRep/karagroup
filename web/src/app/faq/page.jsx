import FAQItem from '@/components/FAQItem'

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const metadata = {
  title: 'Частые вопросы',
  description: 'Ответы на популярные вопросы о буст-услугах KaraShop: сроки, гарантии, оплата и возврат.',
  alternates: { canonical: '/faq' },
}

async function getFAQ() {
  try {
    const res = await fetch(`${API_URL}/faq/`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export default async function FAQPage() {
  const items = await getFAQ()

  const jsonLd = items.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Частые вопросы</h1>
          <p className="text-slate-400">Ответы на популярные вопросы о наших услугах</p>
        </div>

        {items.length === 0 && (
          <p className="text-slate-500 text-center py-16">Вопросы скоро появятся</p>
        )}

        <div className="space-y-2">
          {items.map(item => <FAQItem key={item.id} item={item} />)}
        </div>
      </div>
    </>
  )
}
