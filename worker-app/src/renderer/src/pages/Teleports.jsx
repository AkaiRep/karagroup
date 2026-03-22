import { useEffect, useState } from 'react'
import { getTeleportGroups, getTeleportPresets, downloadTeleportPreset } from '../api'

const VK_NAMES = {
  9: 'TAB', 13: 'Enter', 27: 'Esc', 32: 'Space',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
}
const getKeyLabel = (vk) => {
  const code = parseInt(vk, 16)
  if (VK_NAMES[code]) return VK_NAMES[code]
  if (code >= 65 && code <= 90) return String.fromCharCode(code)
  if (code >= 48 && code <= 57) return String.fromCharCode(code)
  return `0x${code.toString(16).toUpperCase()}`
}

export default function Teleports() {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [presets, setPresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [status, setStatus] = useState({})
  const [mapKey, setMapKey] = useState(() => localStorage.getItem('teleportMapKey') || '0x09')
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    getTeleportGroups().then(setGroups).catch(() => {})
  }, [])

  const selectGroup = async (group) => {
    setSelectedGroup(group)
    setLoadingPresets(true)
    try {
      const data = await getTeleportPresets(group.id)
      setPresets(data)
    } catch {
      setPresets([])
    } finally {
      setLoadingPresets(false)
    }
  }

  const handleDeploy = async (preset) => {
    setStatus(s => ({ ...s, [preset.id]: { state: 'running' } }))
    try {
      const buffer = await downloadTeleportPreset(preset.id)
      // Pass as Uint8Array — more reliable across Electron IPC than raw ArrayBuffer
      const result = await window.electronBridge.runTeleport(new Uint8Array(buffer), mapKey)
      if (result?.success) {
        setStatus(s => ({ ...s, [preset.id]: { state: 'ok' } }))
      } else {
        setStatus(s => ({ ...s, [preset.id]: { state: 'error', msg: result?.error || 'Неизвестная ошибка' } }))
      }
    } catch (e) {
      setStatus(s => ({ ...s, [preset.id]: { state: 'error', msg: String(e?.message || e) } }))
    }
    setTimeout(() => setStatus(s => { const n = { ...s }; delete n[preset.id]; return n }), 6000)
  }

  return (
    <div className="flex h-full">
      {/* Groups sidebar */}
      <div className="w-56 border-r border-slate-700/50 flex flex-col bg-[#1a1f2e]">
        <div className="px-4 py-4 border-b border-slate-700/50">
          <div className="text-sm font-medium text-slate-300 mb-3">Группы телепортов</div>
          <div className="text-xs text-slate-500 mb-1.5">Клавиша карты</div>
          {capturing ? (
            <div
              className="text-xs text-center py-2 px-3 rounded border border-brand-500/40 bg-brand-500/10 text-brand-400 animate-pulse cursor-default"
              tabIndex={0}
              autoFocus
              onKeyDown={e => {
                e.preventDefault()
                const vk = '0x' + e.keyCode.toString(16).padStart(2, '0')
                setMapKey(vk)
                localStorage.setItem('teleportMapKey', vk)
                setCapturing(false)
              }}
              onBlur={() => setCapturing(false)}
            >
              Нажмите клавишу...
            </div>
          ) : (
            <button
              onClick={() => setCapturing(true)}
              className="w-full text-xs py-1.5 px-3 rounded border border-white/10 bg-black/20 text-slate-300 hover:text-white hover:border-white/20 transition-colors text-left"
            >
              <span className="text-slate-500">Клавиша: </span>
              <span className="text-brand-400 font-mono font-medium">{getKeyLabel(mapKey)}</span>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto py-2">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => selectGroup(g)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selectedGroup?.id === g.id
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              📁 {g.name}
            </button>
          ))}
          {groups.length === 0 && (
            <div className="px-4 py-6 text-xs text-slate-600 text-center">Нет групп</div>
          )}
        </div>
      </div>

      {/* Presets list */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedGroup ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Выберите группу
          </div>
        ) : loadingPresets ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">Загрузка...</div>
        ) : (
          <>
            <div className="text-lg font-semibold text-white mb-4">📁 {selectedGroup.name}</div>
            <div className="space-y-2">
              {presets.map(p => {
                const s = status[p.id]
                const st = s?.state
                return (
                  <div key={p.id} className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <span className="text-sm text-slate-200">{p.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeploy(p)}
                        disabled={!!st}
                        className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-60 ${
                          st === 'ok'      ? 'bg-green-500/15 border-green-500/30 text-green-400' :
                          st === 'error'   ? 'bg-red-500/15 border-red-500/30 text-red-400' :
                          st === 'running' ? 'bg-slate-700/50 border-white/10 text-slate-400' :
                          'bg-brand-500/15 border-brand-500/30 text-brand-400 hover:bg-brand-500/25'
                        }`}
                      >
                        {st === 'running' ? '⏳ Выполняется...' :
                         st === 'ok'      ? '✓ Готово' :
                         st === 'error'   ? '✗ Ошибка' :
                         '▶ Загрузить'}
                      </button>
                    </div>
                    {st === 'error' && s?.msg && (
                      <div className="mt-2 text-xs text-red-400 font-mono">{s.msg}</div>
                    )}
                  </div>
                )
              })}
              {presets.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-16">В этой группе нет пресетов</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
