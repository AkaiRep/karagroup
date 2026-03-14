import { useEffect, useState } from 'react'
import { getSiteSettings, updateSiteSetting } from '../api'

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-amber-500' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Field({ label, hint, value, onChange, multiline = false, rows = 3 }) {
  return (
    <div>
      <label className="text-sm text-slate-300 block mb-1 font-medium">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500/50 transition-colors resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
        />
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700/50 bg-[#151922]">
        <h2 className="font-semibold text-slate-200">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

const DEFAULTS = {
  dev_banner_text: 'Сайт находится в разработке — возможны временные неполадки',
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

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState({})
  const [saved, setSaved] = useState({})

  useEffect(() => {
    getSiteSettings()
      .then(data => setSettings(data))
      .finally(() => setLoading(false))
  }, [])

  const get = (key) => (key in settings ? settings[key] : DEFAULTS[key] || '')

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

  const SaveBtn = ({ k }) => (
    <button
      onClick={() => save(k)}
      disabled={!dirty[k]}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        saved[k] ? 'bg-green-500/20 text-green-400' :
        dirty[k] ? 'bg-green-600 hover:bg-green-500 text-white' :
        'bg-slate-700/40 text-slate-500 cursor-default'
      }`}
    >
      {saved[k] ? 'Сохранено!' : 'Сохранить'}
    </button>
  )

  if (loading) return <div className="p-8 text-slate-400">Загрузка...</div>

  return (
    <div className="p-8 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold mb-6">Настройки сайта</h1>

      {/* Баннер */}
      <Section title="Баннер разработки">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Показывать баннер</p>
            <p className="text-xs text-slate-500 mt-0.5">Пульсирующая плашка с бегущей строкой сверху сайта</p>
          </div>
          <Toggle value={get('dev_banner_enabled') === 'true'} onChange={() => toggle('dev_banner_enabled')} />
        </div>
        <div className="space-y-1">
          <Field label="Текст баннера" value={get('dev_banner_text')} onChange={v => set('dev_banner_text', v)} />
          <div className="flex justify-end"><SaveBtn k="dev_banner_text" /></div>
        </div>
      </Section>

      {/* Hero */}
      <Section title="Главная — Hero">
        {[
          { k: 'hero_badge', label: 'Текст значка (зелёный)' },
          { k: 'hero_title', label: 'Заголовок (градиентный)' },
          { k: 'hero_button', label: 'Кнопка CTA' },
        ].map(({ k, label }) => (
          <div key={k} className="space-y-1">
            <Field label={label} value={get(k)} onChange={v => set(k, v)} />
            <div className="flex justify-end"><SaveBtn k={k} /></div>
          </div>
        ))}
        <div className="space-y-1">
          <Field label="Подзаголовок" value={get('hero_subtitle')} onChange={v => set('hero_subtitle', v)} multiline rows={3} />
          <div className="flex justify-end"><SaveBtn k="hero_subtitle" /></div>
        </div>
      </Section>

      {/* О нас */}
      <Section title="Блок «О нас»">
        <div className="space-y-1">
          <Field label="Текст «Кто мы»" value={get('about_text')} onChange={v => set('about_text', v)} multiline rows={4} />
          <div className="flex justify-end"><SaveBtn k="about_text" /></div>
        </div>
        <div className="space-y-1">
          <Field
            label="Наши гарантии"
            hint="Каждая гарантия — на новой строке"
            value={get('guarantees')}
            onChange={v => set('guarantees', v)}
            multiline
            rows={5}
          />
          <div className="flex justify-end"><SaveBtn k="guarantees" /></div>
        </div>
      </Section>

      {/* Статистика */}
      <Section title="Блок «Почему выбирают нас»">
        <div className="space-y-1">
          <Field label="Заголовок" value={get('stats_title')} onChange={v => set('stats_title', v)} />
          <div className="flex justify-end"><SaveBtn k="stats_title" /></div>
        </div>
        <div className="space-y-1">
          <Field label="Подзаголовок" value={get('stats_subtitle')} onChange={v => set('stats_subtitle', v)} multiline rows={2} />
          <div className="flex justify-end"><SaveBtn k="stats_subtitle" /></div>
        </div>
        {[1, 2, 3].map(n => (
          <div key={n} className="border border-slate-700/50 rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Стата {n}</p>
            {[
              { k: `stat_${n}_num`, label: 'Цифра' },
              { k: `stat_${n}_label`, label: 'Заголовок' },
              { k: `stat_${n}_desc`, label: 'Описание' },
            ].map(({ k, label }) => (
              <div key={k} className="space-y-1">
                <Field label={label} value={get(k)} onChange={v => set(k, v)} />
                <div className="flex justify-end"><SaveBtn k={k} /></div>
              </div>
            ))}
          </div>
        ))}
      </Section>
    </div>
  )
}
