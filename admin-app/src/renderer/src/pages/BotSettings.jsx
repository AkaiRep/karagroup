import { useEffect, useState } from 'react'
import { getSiteSettings, updateSiteSetting } from '../api'

export default function BotSettings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSiteSettings().then(s => { setSettings(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const get = (key, def = '') => settings[key] ?? def

  const toggle = async (key) => {
    const next = get(key) === 'false' ? 'true' : 'false'
    setSettings(s => ({ ...s, [key]: next }))
    setSaving(true)
    await updateSiteSetting(key, next).catch(() => {})
    setSaving(false)
  }

  const shopEnabled = get('bot_shop_enabled') !== 'false'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-500 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Настройки бота</h1>
      <p className="text-slate-500 text-sm mb-8">Управление Telegram-ботом</p>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-semibold text-white">Магазин</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {shopEnabled
                ? 'Включён — товары отображаются в боте'
                : 'Выключен — бот перенаправляет в Mini App'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={shopEnabled}
              onChange={() => toggle('bot_shop_enabled')}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-brand-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        {!shopEnabled && (
          <div className="px-5 pb-4 border-t border-border/50">
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-400">
                При нажатии на «Магазин» бот отправит сообщение с кнопкой для перехода в Mini App (WEB_APP_URL из .env бота).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
