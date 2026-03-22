import { useEffect, useState } from 'react'
import { getTeleportGroups, getTeleportPresets, downloadTeleportPreset } from '../api'

export default function Teleports() {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [presets, setPresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [status, setStatus] = useState({}) // presetId -> 'running' | 'ok' | 'error'

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
    setStatus(s => ({ ...s, [preset.id]: 'running' }))
    try {
      // Download JSON
      const buffer = await downloadTeleportPreset(preset.id)
      // Write to temp file via IPC
      const result = await window.electronBridge.runTeleport(buffer)
      setStatus(s => ({ ...s, [preset.id]: result?.success ? 'ok' : 'error' }))
    } catch {
      setStatus(s => ({ ...s, [preset.id]: 'error' }))
    }
    setTimeout(() => setStatus(s => { const n = { ...s }; delete n[preset.id]; return n }), 4000)
  }

  return (
    <div className="flex h-full">
      {/* Groups sidebar */}
      <div className="w-56 border-r border-slate-700/50 flex flex-col bg-[#1a1f2e]">
        <div className="px-4 py-4 border-b border-slate-700/50">
          <div className="text-sm font-medium text-slate-300">Группы телепортов</div>
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
                const st = status[p.id]
                return (
                  <div key={p.id} className="flex items-center justify-between bg-[#1a1f2e] border border-slate-700/50 rounded-xl px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <span className="text-sm text-slate-200">{p.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeploy(p)}
                      disabled={!!st}
                      className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-60 ${
                        st === 'ok' ? 'bg-green-500/15 border-green-500/30 text-green-400' :
                        st === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-400' :
                        st === 'running' ? 'bg-slate-700/50 border-white/10 text-slate-400' :
                        'bg-brand-500/15 border-brand-500/30 text-brand-400 hover:bg-brand-500/25'
                      }`}
                    >
                      {st === 'running' ? '⏳ Выполняется...' :
                       st === 'ok' ? '✓ Готово' :
                       st === 'error' ? '✗ Ошибка' :
                       '▶ Загрузить'}
                    </button>
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
