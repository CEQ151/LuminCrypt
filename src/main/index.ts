import { app, shell, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join, extname, normalize } from 'path'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// ─── Simple persistent store ──────────────────────────────────────────────────
let storeCache: Record<string, unknown> = {}
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:'])
const ALLOWED_QUALITY = new Set(['invisible', 'balanced', 'robust'])
const ALLOWED_IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'])
const MAX_TEXT_PAYLOAD = 2_000_000
const MAX_PDF_HTML_B64 = 10_000_000

function isSafeExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return ALLOWED_EXTERNAL_PROTOCOLS.has(u.protocol)
  } catch {
    return false
  }
}

function isSafeAppNavigation(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol === 'file:' || u.protocol === 'devtools:' || u.protocol === 'app:') return true
    if (
      is.dev &&
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function isValidPathInput(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 4096 && !v.includes('\0')
}

function isAllowedImagePath(pathLike: string): boolean {
  const ext = extname(normalize(pathLike)).toLowerCase()
  return ALLOWED_IMG_EXT.has(ext)
}

function sanitizeStoreKey(key: unknown): string | null {
  if (typeof key !== 'string') return null
  const k = key.trim()
  if (k.length === 0 || k.length > 128) return null
  if (!/^[a-zA-Z0-9._:-]+$/.test(k)) return null
  return k
}

async function loadStore(): Promise<void> {
  try {
    const p = join(app.getPath('userData'), 'settings.json')
    if (existsSync(p)) {
      const raw = await readFile(p, 'utf-8')
      storeCache = JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[store] failed to load settings:', err)
  }
}

async function saveStore(): Promise<void> {
  try {
    const p = join(app.getPath('userData'), 'settings.json')
    await writeFile(p, JSON.stringify(storeCache, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[store] failed to save settings:', err)
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    ...(process.platform === 'linux' ? { icon } : { icon }),
    ...(process.platform === 'win32' ? { titleBarOverlay: false } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[renderer] did-fail-load:', { code, desc, url })
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer] process gone:', details)
  })
  mainWindow.webContents.on('console-message', (_event, msg) => {
    const tag = ['VERBOSE', 'INFO', 'WARN', 'ERROR'][msg.level] ?? 'LOG'
    console.log(`[renderer:${tag}] ${msg.message} (${msg.sourceUrl}:${msg.lineNumber})`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (details) => {
    if (!isSafeAppNavigation(details.url)) {
      console.warn('[security] blocked navigation to:', details.url)
      details.preventDefault()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).catch((err) => {
      console.error('[window] failed to load dev URL:', err)
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('[window] failed to load renderer file:', err)
    })
  }
}

app.whenReady().then(async () => {
  await loadStore()

  electronApp.setAppUserModelId('com.lumincrypt.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Window control IPC
  ipcMain.on('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  // ─── Store IPC ────────────────────────────────────────────────────────────
  ipcMain.handle('store:getAll', () => ({ ...storeCache }))
  ipcMain.handle('store:get', (_e, key: string) => {
    const k = sanitizeStoreKey(key)
    if (!k) return undefined
    return storeCache[k]
  })
  ipcMain.handle('store:set', async (_e, key: string, value: unknown) => {
    const k = sanitizeStoreKey(key)
    if (!k) return
    storeCache[k] = value
    await saveStore()
  })

  // ─── Clipboard IPC ────────────────────────────────────────────────────────
  ipcMain.handle('clipboard:read', () => clipboard.readText())

  // ─── File save dialog IPC ─────────────────────────────────────────────────
  ipcMain.handle(
    'dialog:saveFile',
    async (_event, content: string, ext: 'json' | 'pdf', defaultName: string) => {
      if (typeof content !== 'string' || content.length > MAX_TEXT_PAYLOAD) {
        return { success: false, error: 'Invalid content payload' }
      }
      if (typeof defaultName !== 'string' || defaultName.length === 0 || defaultName.length > 255) {
        return { success: false, error: 'Invalid file name' }
      }
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return { success: false, error: 'No window' }

      const filters =
        ext === 'json'
          ? [{ name: 'JSON Report', extensions: ['json'] }]
          : [{ name: 'PDF Report', extensions: ['pdf'] }]

      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Save Report',
        defaultPath: defaultName,
        filters,
      })

      if (canceled || !filePath) return { success: false, error: 'Canceled' }

      try {
        if (ext === 'json') {
          await writeFile(filePath, content, 'utf-8')
        } else {
          await writeFile(filePath, Buffer.from(content, 'base64'))
        }
        return { success: true, filePath }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── CSV save dialog IPC ──────────────────────────────────────────────────
  ipcMain.handle('dialog:saveCSV', async (_event, content: string, defaultName: string) => {
    if (typeof content !== 'string' || content.length > MAX_TEXT_PAYLOAD) {
      return { success: false, error: 'Invalid CSV payload' }
    }
    if (typeof defaultName !== 'string' || defaultName.length === 0 || defaultName.length > 255) {
      return { success: false, error: 'Invalid file name' }
    }
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出 CSV 报告',
      defaultPath: defaultName,
      filters: [{ name: 'CSV File', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return { success: false, error: 'Canceled' }

    try {
      // Write UTF-8 BOM for Excel compatibility
      await writeFile(filePath, '\uFEFF' + content, 'utf-8')
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─── PDF from HTML via printToPDF ─────────────────────────────────────────
  ipcMain.handle('dialog:exportPDF', async (_event, htmlB64: string, defaultName: string) => {
    if (typeof htmlB64 !== 'string' || htmlB64.length === 0 || htmlB64.length > MAX_PDF_HTML_B64) {
      return { success: false, error: 'Invalid PDF payload' }
    }
    if (typeof defaultName !== 'string' || defaultName.length === 0 || defaultName.length > 255) {
      return { success: false, error: 'Invalid file name' }
    }
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No window' }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出 PDF 报告',
      defaultPath: defaultName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { success: false, error: 'Canceled' }

    const pdfWin = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true },
    })
    try {
      await pdfWin.loadURL(`data:text/html;base64,${htmlB64}`)
      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      })
      await writeFile(filePath, pdfData)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    } finally {
      pdfWin.destroy()
    }
  })

  // ─── Image Blind Watermark IPC ────────────────────────────────────────────

  const BWM_EXE = process.platform === 'win32' ? 'bwm_helper.exe' : 'bwm_helper'

  /** Find the pre-built standalone executable bundled with the app (preferred). */
  function findBundledExe(): string | null {
    const p = is.dev
      ? join(app.getAppPath(), 'resources', 'bin', BWM_EXE)
      : join(process.resourcesPath, 'bin', BWM_EXE)
    return existsSync(p) ? p : null
  }

  /** Try Python executables in PATH (developer fallback when exe not yet built).
   *  On Windows, resolves to the absolute path via `where` to avoid PATH lookup
   *  issues when Electron is launched outside a terminal. */
  async function findPythonExe(): Promise<string | null> {
    if (process.platform === 'win32') {
      for (const cmd of ['python', 'python3', 'py']) {
        const resolved = await new Promise<string | null>((resolve) => {
          const c = spawn('where', [cmd], { windowsHide: true, timeout: 4000, shell: true })
          let out = ''
          c.stdout?.on('data', (d: Buffer) => { out += d.toString() })
          c.on('close', (code) => {
            if (code !== 0) return resolve(null)
            const line = out.trim().split('\n')[0]?.trim()
            resolve(line && line.length > 0 ? line : null)
          })
          c.on('error', () => resolve(null))
        })
        if (resolved) return resolved
      }
      return null
    }
    for (const cmd of ['python3', 'python']) {
      const ok = await new Promise<boolean>((resolve) => {
        const c = spawn(cmd, ['--version'], { timeout: 4000 })
        c.on('close', (code) => resolve(code === 0))
        c.on('error', () => resolve(false))
      })
      if (ok) return cmd
    }
    return null
  }

  type BwmRunner = { mode: 'exe'; exePath: string } | { mode: 'python'; python: string }

  /** Resolve the best available runner: bundled exe first, then system Python. */
  async function getRunner(): Promise<BwmRunner | null> {
    const exePath = findBundledExe()
    if (exePath) return { mode: 'exe', exePath }
    const python = await findPythonExe()
    return python ? { mode: 'python', python } : null
  }

  /** Path to bwm_helper.py (used only in Python fallback mode). */
  function bwmScriptPath(): string {
    return is.dev
      ? join(app.getAppPath(), 'blind_watermark', 'bwm_helper.py')
      : join(process.resourcesPath, 'bwm_helper.py')
  }

  /**
   * Run bwm_helper with options passed via JSON stdin (avoids Windows Unicode
   * command-line encoding issues). Parses last JSON stdout line.
   */
  function runBwm(runner: BwmRunner, opts: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      const spawnEnv = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
      const child =
        runner.mode === 'exe'
          ? spawn(runner.exePath, ['--json-stdin'], { windowsHide: true, timeout: 120_000, env: spawnEnv })
          : spawn(runner.python, [bwmScriptPath(), '--json-stdin'], {
              windowsHide: true,
              timeout: 120_000,
              env: spawnEnv,
              cwd: is.dev ? join(app.getAppPath(), 'blind_watermark') : process.resourcesPath,
            })

      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString('utf8')
      })
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString('utf8')
      })
      child.on('close', (code) => {
        const lines = stdout.trim().split('\n').filter(Boolean)
        const lastLine = lines[lines.length - 1] ?? ''
        try {
          resolve(JSON.parse(lastLine))
        } catch {
          resolve({
            ok: false,
            error: lastLine || stderr.trim() || `Process exited with code ${code}`,
          })
        }
      })
      child.on('error', (err) => {
        resolve({ ok: false, error: err.message })
      })

      // Write opts as UTF-8 JSON to stdin then close
      const payload = Buffer.from(JSON.stringify(opts), 'utf-8')
      child.stdin?.write(payload)
      child.stdin?.end()
    })
  }

  // Detect available engine (bundled exe takes priority over system Python)
  ipcMain.handle('image-wm:checkPython', async () => {
    const exePath = findBundledExe()
    if (exePath) {
      const result = await runBwm({ mode: 'exe', exePath }, { mode: 'check' })
      return { ...result, mode: 'exe', python: null }
    }
    const python = await findPythonExe()
    if (!python) {
      return { ok: false, mode: 'python', python: null, error: 'no-runner' }
    }
    const result = await runBwm({ mode: 'python', python }, { mode: 'check' })
    return { ...result, mode: 'python', python }
  })

  // Open image file dialog
  ipcMain.handle('image-wm:openImage', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '选择源图片',
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  // Save image file dialog
  ipcMain.handle('image-wm:saveImage', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '保存含水印图片',
      defaultPath: 'watermarked.png',
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    })
    return canceled || !filePath ? null : filePath
  })

  // Embed watermark into image
  ipcMain.handle(
    'image-wm:embed',
    async (_e, opts: { inputPath: string; outputPath: string; wmText: string; password: number; quality: string }) => {
      if (
        !opts ||
        !isValidPathInput(opts.inputPath) ||
        !isValidPathInput(opts.outputPath) ||
        typeof opts.wmText !== 'string' ||
        opts.wmText.trim().length === 0 ||
        opts.wmText.length > 4096 ||
        !Number.isInteger(opts.password) ||
        opts.password < 0 ||
        opts.password > 2_147_483_647 ||
        !ALLOWED_QUALITY.has(opts.quality) ||
        !isAllowedImagePath(opts.inputPath) ||
        !isAllowedImagePath(opts.outputPath)
      ) {
        return { ok: false, error: 'Invalid image embed parameters' }
      }
      const runner = await getRunner()
      if (!runner) return { ok: false, error: '未找到可用的执行引擎' }
      return runBwm(runner, {
        mode: 'embed',
        input: opts.inputPath,
        output: opts.outputPath,
        wm: opts.wmText,
        password: opts.password,
        quality: opts.quality,
      })
    }
  )

  // Extract watermark from image
  ipcMain.handle(
    'image-wm:extract',
    async (_e, opts: { inputPath: string; password: number }) => {
      if (
        !opts ||
        !isValidPathInput(opts.inputPath) ||
        !Number.isInteger(opts.password) ||
        opts.password < 0 ||
        opts.password > 2_147_483_647 ||
        !isAllowedImagePath(opts.inputPath)
      ) {
        return { ok: false, error: 'Invalid image extract parameters' }
      }
      const runner = await getRunner()
      if (!runner) return { ok: false, error: '未找到可用的执行引擎' }
      return runBwm(runner, {
        mode: 'extract',
        input: opts.inputPath,
        password: opts.password,
      })
    }
  )

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
