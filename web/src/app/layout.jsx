import './globals.css'
import Providers from './providers'
import Script from 'next/script'
import DevBanner from '@/components/DevBanner'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://karashop.ru'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function generateMetadata() {
  let s = {}
  try {
    const res = await fetch(`${API_URL}/site-settings/`, { next: { revalidate: 300 } })
    s = await res.json()
  } catch {}

  const title = s.seo_title || 'KaraShop — Буст аккаунтов'
  const description = s.seo_description || 'Профессиональный буст игровых аккаунтов. Быстро, безопасно, с гарантией результата.'
  const keywords = s.seo_keywords || 'буст аккаунтов, буст, игровой буст, повышение ранга'
  const ogImage = s.seo_og_image || `${SITE_URL}/hero-bg.jpg`

  return {
    title: { default: title, template: `%s | KaraShop` },
    description,
    keywords,
    icons: { icon: '/favicon.ico' },
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: SITE_URL },
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      url: SITE_URL,
      siteName: 'KaraShop',
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  }
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'KaraShop',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', availableLanguage: 'Russian' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script id="yandex-metrika" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=107698834','ym');
          ym(107698834,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
        <noscript><img src="https://mc.yandex.ru/watch/107698834" style={{position:'absolute',left:'-9999px'}} alt="" /></noscript>
        <Providers>
          <DevBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}
