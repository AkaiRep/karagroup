import { useEffect, useState, useMemo } from 'react'
import { getSiteSettings, updateSiteSetting } from '../api'

const DEFAULTS = {
  dev_banner_text: 'Сайт находится в разработке — возможны временные неполадки',
  dev_banner_color: '#fbbf24',
  hero_badge: 'Принимаем заказы',
  hero_title: 'Профессиональный игровой буст',
  hero_subtitle: 'Поднимем ваш ранг быстро и безопасно. Работаем с топовыми игроками, гарантируем результат.',
  hero_button: 'Смотреть услуги',
  about_text: 'KaraShop — профессиональный сервис буста игровых аккаунтов. Мы работаем с опытными игроками, которые помогут вам достичь желаемого ранга быстро и безопасно.',
  guarantees: 'Безопасность аккаунта — работаем с использованием VPN\nГарантия результата или возврат средств\nОперативное выполнение заказов\nПоддержка 24/7 в Telegram',
  stats_title: 'Почему выбирают нас',
  stats_subtitle: 'Мы — команда профессиональных игроков с многолетним опытом. Ценим доверие каждого клиента.',
  stat_1_num: '500+', stat_1_label: 'Выполненных заказов', stat_1_desc: 'За всё время работы',
  stat_2_num: '100%', stat_2_label: 'Гарантия результата', stat_2_desc: 'Или вернём деньги',
  stat_3_num: '<2ч',  stat_3_label: 'Время отклика',       stat_3_desc: 'Начинаем работу быстро',
}

// Flat list of all fields for search
const ALL_FIELDS = [
  { tab: 'banner', key: 'dev_banner_enabled', label: 'Показывать баннер', type: 'toggle' },
  { tab: 'banner', key: 'dev_banner_text',    label: 'Текст баннера', type: 'text' },
  { tab: 'banner', key: 'dev_banner_color',   label: 'Цвет баннера', type: 'color' },
  { tab: 'hero',   key: 'hero_badge',    label: 'Текст значка (зелёный)', type: 'text' },
  { tab: 'hero',   key: 'hero_title',    label: 'Заголовок (градиентный)', type: 'text' },
  { tab: 'hero',   key: 'hero_subtitle', label: 'Подзаголовок', type: 'textarea', rows: 3 },
  { tab: 'hero',   key: 'hero_button',   label: 'Кнопка CTA', type: 'text' },
  { tab: 'about',  key: 'about_text',    label: 'Текст «Кто мы»', type: 'textarea', rows: 4 },
  { tab: 'about',  key: 'guarantees',    label: 'Наши гарантии', hint: 'Каждая гарантия — на новой строке', type: 'textarea', rows: 5 },
  { tab: 'stats',  key: 'stats_title',   label: 'Заголовок блока', type: 'text' },
  { tab: 'stats',  key: 'stats_subtitle',label: 'Подзаголовок блока', type: 'textarea', rows: 2 },
  { tab: 'stats',  key: 'stat_1_num',    label: 'Стата 1 — Цифра', type: 'text' },
  { tab: 'stats',  key: 'stat_1_label',  label: 'Стата 1 — Заголовок', type: 'text' },
  { tab: 'stats',  key: 'stat_1_desc',   label: 'Стата 1 — Описание', type: 'text' },
  { tab: 'stats',  key: 'stat_2_num',    label: 'Стата 2 — Цифра', type: 'text' },
  { tab: 'stats',  key: 'stat_2_label',  label: 'Стата 2 — Заголовок', type: 'text' },
  { tab: 'stats',  key: 'stat_2_desc',   label: 'Стата 2 — Описание', type: 'text' },
  { tab: 'stats',  key: 'stat_3_num',    label: 'Стата 3 — Цифра', type: 'text' },
  { tab: 'stats',  key: 'stat_3_label',  label: 'Стата 3 — Заголовок', type: 'text' },
  { tab: 'stats',  key: 'stat_3_desc',   label: 'Стата 3 — Описание', type: 'text' },
]

const TABS = [
  { id: 'all',    label: 'Все' },
  { id: 'banner', label: 'Баннер' },
  { id: 'hero',   label: 'Hero' },
  { id: 'about',  label: 'О нас' },
  { id: 'stats',  label: 'Статистика' },
]

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState({})
  const [saved, setSaved] = useState({})
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getSiteSettings()
      .then(data => setSettings(data))
      .finally(() => setLoading(false))
  }, [])

  const get = (key) => key in settings ? settings[key] : (DEFAULTS[key] ?? '')

  const set = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }))
    setDirty(d => ({ ...d, [key]: true }))
  }

  const toggle = async (key) => {
    const newVal = get(key) === 'true' ? 'false' : 'true'
    setSettings(s => ({ ...s, [key]: newVal }))
    await updateSiteSetting(key, newVal)
  }

  const save = async (key) => {
    await updateSiteSetting(key, get(key))
    setDirty(d => { const n = { ...d }; delete n[key]; return n })
    setSaved(s => ({ ...s, [key]: true }))
    setTimeout(() => setSaved(s => { const n = { ...s }; delete n[key]; return n }), 2000)
  }

  const visibleFields = useMemo(() => {
    const q = search.toLowerCase()
    return ALL_FIELDS.filter(f => {
      const matchTab = activeTab === 'all' || f.tab === activeTab
      const matchSearch = !q || f.label.toLowerCase().includes(q) || (get(f.key) || '').toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [activeTab, search, settings])

  if (loading) return <div className="p-8 text-slate-400">Загрузка...</div>

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Настройки сайта</h1>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveTab('all') }}
          placeholder="Поиск по настройкам..."
          className="w-full bg-[#1a1f2e] border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-green-500/50 transition-colors placeholder-slate-600"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      {!search && (
        <div className="flex gap-1 mb-6 bg-[#1a1f2e] p-1 rounded-xl border border-slate-700/50">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Fields */}
      {visibleFields.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Ничего не найдено</div>
      ) : (
        <div className="space-y-3">
          {visibleFields.map(field => (
            <div key={field.key} className="bg-[#1a1f2e] rounded-xl border border-slate-700/50 p-4">
              {field.type === 'toggle' ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{field.label}</p>
                    {search && <p className="text-xs text-slate-500 mt-0.5">{TABS.find(t => t.id === field.tab)?.label}</p>}
                  </div>
                  <button
                    onClick={() => toggle(field.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${get(field.key) === 'true' ? 'bg-amber-500' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${get(field.key) === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="text-sm font-medium text-slate-200">{field.label}</label>
                      {search && <span className="ml-2 text-xs text-slate-500">{TABS.find(t => t.id === field.tab)?.label}</span>}
                      {field.hint && <p className="text-xs text-slate-500 mt-0.5">{field.hint}</p>}
                    </div>
                    <button
                      onClick={() => save(field.key)}
                      disabled={!dirty[field.key]}
                      className={`ml-3 px-3 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                        saved[field.key] ? 'bg-green-500/20 text-green-400' :
                        dirty[field.key] ? 'bg-green-600 hover:bg-green-500 text-white' :
                        'bg-slate-700/40 text-slate-500 cursor-default'
                      }`}
                    >
                      {saved[field.key] ? 'Сохранено!' : 'Сохранить'}
                    </button>
                  </div>
                  {field.type === 'color' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={get(field.key) || '#fbbf24'}
                        onChange={e => set(field.key, e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        value={get(field.key) || '#fbbf24'}
                        onChange={e => set(field.key, e.target.value)}
                        placeholder="#fbbf24"
                        className="flex-1 bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-green-500/50 transition-colors"
                      />
                      <div
                        className="w-10 h-10 rounded-lg border border-white/10 flex-shrink-0"
                        style={{ background: get(field.key) || '#fbbf24' }}
                      />
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={get(field.key)}
                      onChange={e => set(field.key, e.target.value)}
                      rows={field.rows || 3}
                      className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500/50 transition-colors resize-y"
                    />
                  ) : (
                    <input
                      value={get(field.key)}
                      onChange={e => set(field.key, e.target.value)}
                      className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
