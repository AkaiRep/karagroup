export default function LegalPage({ title, children }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-8 text-white">{title}</h1>
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <div className="bg-[#111318] border border-white/5 rounded-2xl p-6">
      {title && <h2 className="text-base font-semibold text-green-400 mb-3">{title}</h2>}
      <div className="space-y-2 text-slate-400">{children}</div>
    </div>
  )
}
