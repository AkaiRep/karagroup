import { useEffect, useRef, useState } from 'react'
import {
  getTeleportGroups, createTeleportGroup, updateTeleportGroup, deleteTeleportGroup,
  getTeleportPresets, uploadTeleportPreset, deleteTeleportPreset,
} from '../api'

export default function Teleports() {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [presets, setPresets] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const loadGroups = async () => {
    const data = await getTeleportGroups().catch(() => [])
    setGroups(data)
  }

  const loadPresets = async (groupId) => {
    const data = await getTeleportPresets(groupId).catch(() => [])
    setPresets(data)
  }

  useEffect(() => { loadGroups() }, [])

  useEffect(() => {
    if (selectedGroup) loadPresets(selectedGroup.id)
    else setPresets([])
  }, [selectedGroup])

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    await createTeleportGroup(newGroupName.trim())
    setNewGroupName('')
    loadGroups()
  }

  const handleRenameGroup = async (e) => {
    e.preventDefault()
    if (!editGroupName.trim()) return
    await updateTeleportGroup(editingGroup.id, editGroupName.trim())
    setEditingGroup(null)
    if (selectedGroup?.id === editingGroup.id) setSelectedGroup({ ...selectedGroup, name: editGroupName.trim() })
    loadGroups()
  }

  const handleDeleteGroup = async (group) => {
    if (!confirm(`Удалить группу «${group.name}» со всеми пресетами?`)) return
    await deleteTeleportGroup(group.id)
    if (selectedGroup?.id === group.id) setSelectedGroup(null)
    loadGroups()
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadName.trim() || !uploadFile) return
    setUploading(true)
    try {
      await uploadTeleportPreset(selectedGroup.id, uploadName.trim(), uploadFile)
      setUploadName('')
      setUploadFile(null)
      if (fileRef.current) fileRef.current.value = ''
      loadPresets(selectedGroup.id)
    } catch {} finally { setUploading(false) }
  }

  const handleDeletePreset = async (preset) => {
    if (!confirm(`Удалить пресет «${preset.name}»?`)) return
    await deleteTeleportPreset(preset.id)
    loadPresets(selectedGroup.id)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Телепорты</h1>
      <div className="flex gap-6">
        {/* Groups panel */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-surface border border-border/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 text-xs text-slate-500 uppercase font-medium">Группы</div>
            <div className="divide-y divide-border/30">
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => { setSelectedGroup(g); setEditingGroup(null) }}
                  className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selectedGroup?.id === g.id ? 'bg-brand-500/10 text-brand-400' : 'hover:bg-slate-700/20 text-slate-300'}`}
                >
                  {editingGroup?.id === g.id ? (
                    <form onSubmit={handleRenameGroup} className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && setEditingGroup(null)}
                        className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                      <button type="submit" className="text-xs text-brand-400 hover:text-brand-300">✓</button>
                    </form>
                  ) : (
                    <>
                      <span className="text-sm flex-1 truncate">📁 {g.name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 ml-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditingGroup(g); setEditGroupName(g.name) }}
                          className="text-xs text-slate-500 hover:text-slate-300 px-1"
                        >✏️</button>
                        <button
                          onClick={() => handleDeleteGroup(g)}
                          className="text-xs text-red-500 hover:text-red-400 px-1"
                        >×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {groups.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-600 text-sm">Нет групп</div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-border/50">
              <form onSubmit={handleCreateGroup} className="flex gap-2">
                <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Новая группа..."
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
                <button type="submit" className="text-sm px-3 py-1.5 bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-lg hover:bg-brand-500/30 transition-colors">+</button>
              </form>
            </div>
          </div>
        </div>

        {/* Presets panel */}
        <div className="flex-1">
          {!selectedGroup ? (
            <div className="bg-surface border border-border/50 rounded-xl flex items-center justify-center py-24 text-slate-500">
              Выберите группу слева
            </div>
          ) : (
            <div className="bg-surface border border-border/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                <span className="text-sm font-medium text-white">📁 {selectedGroup.name}</span>
                <span className="text-xs text-slate-500">{presets.length} пресетов</span>
              </div>

              {/* Upload form */}
              <div className="px-5 py-4 border-b border-border/30 bg-black/10">
                <form onSubmit={handleUpload} className="flex items-center gap-3">
                  <input
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    placeholder="Название пресета..."
                    className="w-48 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    onChange={e => setUploadFile(e.target.files[0])}
                    className="text-sm text-slate-400 file:mr-3 file:text-xs file:px-3 file:py-1.5 file:rounded-lg file:bg-slate-700 file:border-0 file:text-slate-300 file:cursor-pointer hover:file:bg-slate-600"
                  />
                  <button
                    type="submit"
                    disabled={!uploadName.trim() || !uploadFile || uploading}
                    className="text-sm px-4 py-2 bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-lg hover:bg-brand-500/30 disabled:opacity-40 transition-colors"
                  >
                    {uploading ? 'Загрузка...' : '↑ Загрузить'}
                  </button>
                </form>
              </div>

              {/* Preset list */}
              <div className="divide-y divide-border/30">
                {presets.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-base">📄</span>
                      <span className="text-sm text-slate-200">{p.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePreset(p)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
                {presets.length === 0 && (
                  <div className="px-5 py-10 text-center text-slate-600 text-sm">Нет пресетов — загрузите JSON файл</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
