import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronBridge', {
      captureScreen: () => ipcRenderer.invoke('capture-screen'),
      getScreenSourceId: () => ipcRenderer.invoke('get-screen-source-id'),
    })
  } catch (e) {
    console.error(e)
  }
}
