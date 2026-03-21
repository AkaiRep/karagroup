import { app, shell, BrowserWindow, dialog, Menu, ipcMain, desktopCapturer, powerSaveBlocker } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

process.on('uncaughtException', (err) => {
  dialog.showErrorBox('Ошибка запуска', err.stack || err.message)
})

// Single instance lock — if launched again while running, show the window
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow = null
let isHidden = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'KaraGroup Worker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false, // prevent timer throttling in background
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Instead of closing — hide and notify renderer to stop heartbeat
  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
    isHidden = true
    mainWindow.webContents.send('visibility-change', false)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Second instance launched — show window
app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show()
    isHidden = false
    mainWindow.webContents.send('visibility-change', true)
  }
})

// ── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    })
    if (!sources.length) return null
    return sources[0].thumbnail.toJPEG(60).toString('base64')
  } catch {
    return null
  }
})

ipcMain.handle('get-screen-source-id', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    })
    return sources[0]?.id || null
  } catch {
    return null
  }
})

ipcMain.handle('kill-process', (_, name) => new Promise((resolve) => {
  const cmd = process.platform === 'win32'
    ? `taskkill /f /im "${name}"`
    : `pkill -9 "${name}"`
  exec(cmd, () => resolve())
}))

ipcMain.handle('get-processes', () => new Promise((resolve) => {
  const cmd = process.platform === 'win32'
    ? 'tasklist /fo csv /nh'
    : 'ps ax -o comm='
  exec(cmd, (err, stdout) => {
    if (err) { resolve([]); return }
    let names
    if (process.platform === 'win32') {
      names = stdout.trim().split('\n').map(line => line.split('","')[0].replace(/"/g, '').trim())
    } else {
      names = stdout.trim().split('\n').map(l => l.trim().split('/').pop())
    }
    resolve([...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b)))
  })
}))

ipcMain.handle('force-quit', () => {
  mainWindow.destroy()
  app.quit()
})

ipcMain.handle('remove-autostart', () => {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: false })
  }
})

ipcMain.handle('get-hidden-state', () => isHidden)

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  electronApp.setAppUserModelId('com.karagroup.worker')

  // Prevent app suspension — keeps timers and streams running in background
  powerSaveBlocker.start('prevent-app-suspension')

  // Windows auto-start: add if not already set
  if (process.platform === 'win32') {
    const settings = app.getLoginItemSettings()
    if (!settings.openAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
      })
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Never quit when all windows closed — keep running in background
app.on('window-all-closed', () => {})
