import { useEffect, useState } from 'react'
import { getSiteSettings, updateSiteSetting } from '../api'

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [bannerText, setBannerText] = useState('')
  const [textSaved, setTextSaved] = useState(false)

  useEffect(() => {
    getSiteSettings()
      .then(data => {
        setSettings(data)
        setBannerText(data.dev_banner_text || 'Сайт находится в разработке — возможны временные неполадки')
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (key, current) => {
    const newVal = current === 'true' ? 'false' : 'true'
    await updateSiteSetting(key, newVal)
    setSettings(s => ({ ...s, [key]: newVal }))
  }

  const saveBannerText = async () => {
    await updateSiteSetting('dev_banner_text', bannerText)
    setSettings(s => ({ ...s, dev_banner_text: bannerText }))
    setTextSaved(true)
    setTimeout(() => setTextSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-slate-400">Загрузка...</div>

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Настройки сайта</h1>

      <div className="space-y-4">
        {/* Dev banner toggle */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Баннер разработки</p>
              <p className="text-sm text-slate-400 mt-0.5">Показывать пульсирующую плашку с бегущей строкой сверху сайта</p>
            </div>
            <button
              onClick={() => toggle('dev_banner_enabled', settings.dev_banner_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.dev_banner_enabled === 'true' ? 'bg-amber-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.dev_banner_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Banner text */}
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <label className="text-sm text-slate-400 block mb-2">Текст баннера</label>
            <div className="flex gap-2">
              <input
                value={bannerText}
                onChange={e => setBannerText(e.target.value)}
                className="flex-1 bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <button
                onClick={saveBannerText}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm transition-colors"
              >
                {textSaved ? 'Сохранено!' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
