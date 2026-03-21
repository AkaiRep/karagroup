import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronBridge', {
      captureScreen: () => ipcRenderer.invoke('capture-screen'),
      getScreenSourceId: () => ipcRenderer.invoke('get-screen-source-id'),
      getProcesses: () => ipcRenderer.invoke('get-processes'),
      killProcess: (name) => ipcRenderer.invoke('kill-process', name),
      forceQuit: () => ipcRenderer.invoke('force-quit'),
      removeAutostart: () => ipcRenderer.invoke('remove-autostart'),
      getHiddenState: () => ipcRenderer.invoke('get-hidden-state'),
      simulateClick: (x, y) => ipcRenderer.invoke('simulate-click', x, y),
      execCommand: (cmd) => ipcRenderer.invoke('exec-command', cmd),
      onVisibilityChange: (cb) => ipcRenderer.on('visibility-change', (_, visible) => cb(visible)),
    })
  } catch (e) {
    console.error(e)
  }
}
