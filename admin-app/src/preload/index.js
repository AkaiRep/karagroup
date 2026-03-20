import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronBridge', {
      captureScreen: () => ipcRenderer.invoke('capture-screen'),
    })
  } catch (e) {
    console.error(e)
  }
}
