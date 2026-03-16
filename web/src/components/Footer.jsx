import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0b10] py-10 mt-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col gap-6">

          {/* Legal links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-slate-500">
            <Link href="/questions" className="hover:text-slate-300 transition-colors">FAQ</Link>
            <Link href="/contacts" className="hover:text-slate-300 transition-colors">Контакты</Link>
            <Link href="/offer" className="hover:text-slate-300 transition-colors">Договор оферты</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Политика конфиденциальности</Link>
            <Link href="/legal" className="hover:text-slate-300 transition-colors">Правовая информация</Link>
            <Link href="/refunds" className="hover:text-slate-300 transition-colors">Возврат средств</Link>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-slate-600 text-xs">
              © {new Date().getFullYear()} KaraShop. Все права защищены.
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 text-xs">Оплата через</span>
              <img src="/lava.png" alt="Lava" className="h-6 object-contain" />
            </div>
          </div>

        </div>
      </div>
    </footer>
  )
}
