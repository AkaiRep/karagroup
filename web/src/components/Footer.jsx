export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0b10] py-8 mt-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} KaraShop. Все права защищены.
          </div>

          {/* Платёжные системы */}
          <div className="flex items-center gap-3">
            <span className="text-slate-600 text-xs mr-1">Оплата через</span>

            {/* Lava */}
            <div className="bg-[#111318] border border-white/5 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="text-white text-xs font-semibold">LAVA</span>
            </div>

            {/* Visa */}
            <div className="bg-[#111318] border border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-blue-400 text-xs font-bold italic">VISA</span>
            </div>

            {/* Mastercard */}
            <div className="bg-[#111318] border border-white/5 rounded-lg px-2.5 py-1.5 flex items-center">
              <div className="w-4 h-4 rounded-full bg-red-500 opacity-90" />
              <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-90 -ml-2" />
            </div>

            {/* МИР */}
            <div className="bg-[#111318] border border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-green-400 text-xs font-bold">МИР</span>
            </div>

            {/* СБП */}
            <div className="bg-[#111318] border border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-slate-300 text-xs font-bold">СБП</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
