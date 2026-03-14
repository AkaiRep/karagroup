import './globals.css'
import Providers from './providers'
import Script from 'next/script'
import DevBanner from '@/components/DevBanner'

export const metadata = {
  title: 'KaraShop — Буст аккаунтов',
  description: 'Профессиональный буст игровых аккаунтов',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
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
