export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0b10] py-8 mt-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} KaraShop. Все права защищены.
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-xs">Оплата через</span>
            <img src="/lava.png" alt="Lava" className="h-6 object-contain" />
          </div>
        </div>
      </div>
    </footer>
  )
}
