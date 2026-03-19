import { useEffect, useState } from 'react'
import { getSiteSettings, updateSiteSetting } from '../api'

const LAVA_FIELDS = [
  { key: 'pay_lava_shop_id',       label: 'Shop ID',         secret: false },
  { key: 'pay_lava_secret_key',    label: 'Secret Key',      secret: true  },
  { key: 'pay_lava_additional_key',label: 'Additional Key',  secret: true  },
]

const PLATEGA_FIELDS = [
  { key: 'pay_platega_merchant_id', label: 'Merchant ID', secret: false },
  { key: 'pay_platega_secret',      label: 'Secret',      secret: true  },
  { key: 'pay_platega_return_url',  label: 'Return URL',  secret: false },
]

const COMMISSION_FIELDS = [
  { key: 'pay_commission_sbp',     label: 'СБП (%)',                 default: '11' },
  { key: 'pay_commission_card_rf', label: 'Карта РФ (%)',            default: '12' },
  { key: 'pay_commission_intl',    label: 'Международная / Крипто (%)', default: '5' },
]

function SecretField({ label, value, onChange, onSave, saving, saved }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-[#0d0f14] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 pr-10"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {show ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            )}
          </button>
        </div>
        <SaveBtn onSave={onSave} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, onSave, saving, saved, suffix }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full bg-[#0d0f14] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 ${suffix ? 'pr-10' : ''}`}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
          )}
        </div>
        <SaveBtn onSave={onSave} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

function SaveBtn({ onSave, saving, saved }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        saved
          ? 'bg-green-600/20 text-green-400 border border-green-500/20'
          : 'bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50'
      }`}
    >
      {saved ? '✓ Сохранено' : saving ? '...' : 'Сохранить'}
    </button>
  )
}

function ProviderCard({ title, logo, enabled, onToggle, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {logo}
          <span className="font-semibold text-white">{title}</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={onToggle} className="sr-only peer" />
          <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-brand-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
        </label>
      </div>
      {enabled && (
        <div className="px-5 py-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Payments() {
  const [settings, setSettings] = useState({})
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSiteSettings().then(s => { setSettings(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const get = (key, def = '') => settings[key] ?? def
  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  const save = async (key) => {
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await updateSiteSetting(key, get(key))
      setSaved(s => ({ ...s, [key]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2500)
    } catch {}
    setSaving(s => ({ ...s, [key]: false }))
  }

  const toggle = async (key) => {
    const next = settings[key] === 'false' ? 'true' : 'false'
    set(key, next)
    await updateSiteSetting(key, next).catch(() => {})
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-500 text-sm">Загрузка...</div>
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Платёжные системы</h1>
      <p className="text-slate-500 text-sm mb-8">Настройки провайдеров и комиссий</p>

      <div className="space-y-6">
        {/* LAVA */}
        <ProviderCard
          title="LAVA"
          logo={<img src="lava.png" alt="LAVA" className="h-5 object-contain" />}
          enabled={settings['pay_lava_enabled'] !== 'false'}
          onToggle={() => toggle('pay_lava_enabled')}
        >
          {LAVA_FIELDS.map(f => f.secret ? (
            <SecretField
              key={f.key}
              label={f.label}
              value={get(f.key)}
              onChange={v => set(f.key, v)}
              onSave={() => save(f.key)}
              saving={saving[f.key]}
              saved={saved[f.key]}
            />
          ) : (
            <TextField
              key={f.key}
              label={f.label}
              value={get(f.key)}
              onChange={v => set(f.key, v)}
              onSave={() => save(f.key)}
              saving={saving[f.key]}
              saved={saved[f.key]}
            />
          ))}
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-slate-500 mb-1">URL вебхука (скопируй в LAVA кабинет)</p>
            <div className="flex items-center gap-2 bg-[#0d0f14] border border-border rounded-lg px-3 py-2">
              <code className="text-xs text-slate-300 flex-1 break-all">https://karashop.ru/payments/webhook/lava</code>
              <button
                onClick={() => navigator.clipboard.writeText('https://karashop.ru/payments/webhook/lava')}
                className="text-slate-500 hover:text-brand-400 transition-colors flex-shrink-0"
                title="Скопировать"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </ProviderCard>

        {/* Platega */}
        <ProviderCard
          title="Platega"
          logo={<span className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">P</span>}
          enabled={settings['pay_platega_enabled'] !== 'false'}
          onToggle={() => toggle('pay_platega_enabled')}
        >
          {PLATEGA_FIELDS.map(f => f.secret ? (
            <SecretField
              key={f.key}
              label={f.label}
              value={get(f.key)}
              onChange={v => set(f.key, v)}
              onSave={() => save(f.key)}
              saving={saving[f.key]}
              saved={saved[f.key]}
            />
          ) : (
            <TextField
              key={f.key}
              label={f.label}
              value={get(f.key)}
              onChange={v => set(f.key, v)}
              onSave={() => save(f.key)}
              saving={saving[f.key]}
              saved={saved[f.key]}
            />
          ))}

          {/* Commissions */}
          <div className="pt-2 border-t border-border/50">
            <p className="text-sm font-medium text-slate-300 mb-3">Комиссия на клиента</p>
            <div className="space-y-3">
              {COMMISSION_FIELDS.map(f => (
                <TextField
                  key={f.key}
                  label={f.label}
                  value={get(f.key, f.default)}
                  onChange={v => set(f.key, v)}
                  onSave={() => save(f.key)}
                  saving={saving[f.key]}
                  saved={saved[f.key]}
                  suffix="%"
                />
              ))}
            </div>
          </div>
        </ProviderCard>
      </div>
    </div>
  )
}
