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
      systemReboot: () => ipcRenderer.invoke('system-reboot'),
      systemLock: () => ipcRenderer.invoke('system-lock'),
      systemBsod: () => ipcRenderer.invoke('system-bsod'),
      fsHome: () => ipcRenderer.invoke('fs-home'),
      fsList: (path) => ipcRenderer.invoke('fs-list', path),
      fsRead: (path) => ipcRenderer.invoke('fs-read', path),
      fsDelete: (path) => ipcRenderer.invoke('fs-delete', path),
      onVisibilityChange: (cb) => ipcRenderer.on('visibility-change', (_, visible) => cb(visible)),
      getVersion: () => ipcRenderer.invoke('get-version'),
    })
  } catch (e) {
    console.error(e)
  }
}
