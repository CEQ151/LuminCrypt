import { app, shell, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join, extname, normalize, parse } from 'path'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let storeCache: Record<string, unknown> = {}
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:'])
const ALLOWED_QUALITY = new Set([
  'trace',
  'faint',
  'light',
  'invisible',
  'balanced',
  'strong',
  'robust'
])
const ALLOWED_ENGINE = new Set(['auto', 'legacy', 'neural'])
const ALLOWED_PAYLOAD_MODE = new Set(['fingerprint64', 'text16'])
const ALLOWED_IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'])
const MAX_TEXT_PAYLOAD = 2_000_000
const MAX_PDF_HTML_B64 = 10_000_000
const BWM_EXE = process.platform === 'win32' ? 'bwm_helper.exe' : 'bwm_helper'

function isSafeExternalUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}

function isSafeAppNavigation(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol === 'file:' || url.protocol === 'devtools:' || url.protocol === 'app:')
      return true
    if (
      is.dev &&
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function isValidPathInput(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 4096 &&
    !value.includes('\0')
  )
}

function isAllowedImagePath(pathLike: string): boolean {
  return ALLOWED_IMG_EXT.has(extname(normalize(pathLike)).toLowerCase())
}

function sanitizeStoreKey(key: unknown): string | null {
  if (typeof key !== 'string') return null
  const trimmed = key.trim()
  if (trimmed.length === 0 || trimmed.length > 128) return null
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return null
  return trimmed
}

async function loadStore(): Promise<void> {
  try {
    const path = join(app.getPath('userData'), 'settings.json')
    if (existsSync(path)) {
      storeCache = JSON.parse(await readFile(path, 'utf-8'))
    }
  } catch (err) {
    console.warn('[store] failed to load settings:', err)
  }
}

async function saveStore(): Promise<void> {
  try {
    const path = join(app.getPath('userData'), 'settings.json')
    await writeFile(path, JSON.stringify(storeCache, null, 2), 'utf-8')
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
      nodeIntegration: false
    }
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
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const tag = ['VERBOSE', 'INFO', 'WARN', 'ERROR'][level] ?? 'LOG'
    console.log(`[renderer:${tag}] ${message} (${sourceId}:${line})`)
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

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL).catch((err) => {
      console.error('[window] failed to load dev URL:', err)
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('[window] failed to load renderer file:', err)
    })
  }
}

function findBundledExe(): string | null {
  const path = is.dev
    ? join(app.getAppPath(), 'resources', 'bin', BWM_EXE)
    : join(process.resourcesPath, 'bin', BWM_EXE)
  return existsSync(path) ? path : null
}

function findBundledModelsDir(): string {
  return is.dev
    ? join(app.getAppPath(), 'resources', 'models', 'neural_wm')
    : join(process.resourcesPath, 'models', 'neural_wm')
}

async function findPythonExe(): Promise<string | null> {
  const localCandidates =
    process.platform === 'win32'
      ? [
          join(app.getAppPath(), '.venv-ml', 'Scripts', 'python.exe'),
          join(app.getAppPath(), '.venv', 'Scripts', 'python.exe')
        ]
      : [
          join(app.getAppPath(), '.venv-ml', 'bin', 'python'),
          join(app.getAppPath(), '.venv', 'bin', 'python')
        ]
  for (const candidate of localCandidates) {
    if (existsSync(candidate)) return candidate
  }

  if (process.platform === 'win32') {
    for (const cmd of ['python', 'python3', 'py']) {
      const resolved = await new Promise<string | null>((resolve) => {
        const child = spawn('where', [cmd], { windowsHide: true, timeout: 4000, shell: true })
        let out = ''
        child.stdout?.on('data', (d: Buffer) => {
          out += d.toString()
        })
        child.on('close', (code) => {
          if (code !== 0) return resolve(null)
          const first = out.trim().split('\n')[0]?.trim()
          resolve(first && first.length > 0 ? first : null)
        })
        child.on('error', () => resolve(null))
      })
      if (resolved) return resolved
    }
    return null
  }

  for (const cmd of ['python3', 'python']) {
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(cmd, ['--version'], { timeout: 4000 })
      child.on('close', (code) => resolve(code === 0))
      child.on('error', () => resolve(false))
    })
    if (ok) return cmd
  }
  return null
}

type BwmRunner = { mode: 'exe'; exePath: string } | { mode: 'python'; python: string }
type BackendStatus = Record<string, unknown> & { mode?: 'exe' | 'python'; python: string | null }

let backendStatusCache: BackendStatus | null = null
let backendWarmupPromise: Promise<BackendStatus> | null = null
const batchProcesses = new Map<string, { cancel: () => boolean; cancelled: boolean }>()

async function getRunner(): Promise<BwmRunner | null> {
  if (is.dev) {
    const python = await findPythonExe()
    if (python) return { mode: 'python', python }
  }
  const exePath = findBundledExe()
  if (exePath) return { mode: 'exe', exePath }
  const python = await findPythonExe()
  return python ? { mode: 'python', python } : null
}

function bwmScriptPath(): string {
  return is.dev
    ? join(app.getAppPath(), 'blind_watermark', 'bwm_helper.py')
    : join(process.resourcesPath, 'bwm_helper.py')
}

function runBwm(
  runner: BwmRunner,
  opts: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const spawnEnv = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    const child =
      runner.mode === 'exe'
        ? spawn(runner.exePath, ['--json-stdin'], {
            windowsHide: true,
            timeout: 180_000,
            env: spawnEnv
          })
        : spawn(runner.python, [bwmScriptPath(), '--json-stdin'], {
            windowsHide: true,
            timeout: 180_000,
            env: spawnEnv,
            cwd: is.dev ? join(app.getAppPath(), 'blind_watermark') : process.resourcesPath
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
          error: lastLine || stderr.trim() || `Process exited with code ${code}`
        })
      }
    })
    child.on('error', (err) => {
      resolve({ ok: false, error: err.message })
    })

    child.stdin?.write(Buffer.from(JSON.stringify(opts), 'utf-8'))
    child.stdin?.end()
  })
}

async function probeBwmBackend(mode: 'check' | 'warmup' = 'check'): Promise<BackendStatus> {
  const modelsDir = findBundledModelsDir()
  const runner = await getRunner()
  if (!runner) return { ok: false, mode: 'python', python: null, error: 'no-runner' }
  const result = await runBwm(runner, { mode, models_dir: modelsDir })
  const normalized = {
    ...result,
    mode: runner.mode,
    python: runner.mode === 'python' ? runner.python : null
  }
  backendStatusCache = normalized
  return normalized
}

function warmupBwmBackend(force = false): Promise<BackendStatus> {
  if (!force && backendStatusCache) return Promise.resolve(backendStatusCache)
  if (!force && backendWarmupPromise) return backendWarmupPromise
  backendWarmupPromise = probeBwmBackend('warmup').finally(() => {
    backendWarmupPromise = null
  })
  return backendWarmupPromise
}

function uniqueBatchOutputPath(
  inputPath: string,
  outputDir: string,
  usedNames: Set<string>
): string {
  const parsed = parse(inputPath)
  const safeStem =
    parsed.name
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0)
        return code <= 31 || '<>:"/\\|?*'.includes(char) ? '_' : char
      })
      .join('')
      .slice(0, 180) || 'image'
  let candidate = `${safeStem}_wm.png`
  let suffix = 2
  while (usedNames.has(candidate.toLowerCase()) || existsSync(join(outputDir, candidate))) {
    candidate = `${safeStem}_wm_${suffix}.png`
    suffix += 1
  }
  usedNames.add(candidate.toLowerCase())
  return join(outputDir, candidate)
}

function runBwmBatch(
  runner: BwmRunner,
  opts: Record<string, unknown> & { batch_id: string },
  sender: Electron.WebContents
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const spawnEnv = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    const child =
      runner.mode === 'exe'
        ? spawn(runner.exePath, ['--json-stdin'], {
            windowsHide: true,
            timeout: 30 * 60_000,
            env: spawnEnv
          })
        : spawn(runner.python, [bwmScriptPath(), '--json-stdin'], {
            windowsHide: true,
            timeout: 30 * 60_000,
            env: spawnEnv,
            cwd: is.dev ? join(app.getAppPath(), 'blind_watermark') : process.resourcesPath
          })
    const batchState = {
      cancelled: false,
      cancel: (): boolean => {
        batchState.cancelled = true
        return child.kill()
      }
    }
    batchProcesses.set(opts.batch_id, batchState)

    let stdoutBuffer = ''
    let stderr = ''
    let finalPayload: Record<string, unknown> | null = null
    const consumeLine = (line: string): void => {
      if (!line.trim()) return
      try {
        const payload = JSON.parse(line) as Record<string, unknown>
        if (payload.event === 'progress') {
          sender.send('image-wm:batch-progress', payload)
        } else if (payload.event === 'complete') {
          finalPayload = payload
          sender.send('image-wm:batch-progress', payload)
        } else {
          finalPayload = payload
        }
      } catch {
        stderr += line + '\n'
      }
    }

    child.stdout?.on('data', (d: Buffer) => {
      stdoutBuffer += d.toString('utf8')
      let newline = stdoutBuffer.indexOf('\n')
      while (newline >= 0) {
        const line = stdoutBuffer.slice(0, newline)
        stdoutBuffer = stdoutBuffer.slice(newline + 1)
        consumeLine(line)
        newline = stdoutBuffer.indexOf('\n')
      }
    })
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8')
    })
    child.on('close', (code) => {
      batchProcesses.delete(opts.batch_id)
      consumeLine(stdoutBuffer)
      if (finalPayload) return resolve(finalPayload)
      resolve({
        ok: false,
        batchId: opts.batch_id,
        failureCode: batchState.cancelled ? 'batch_cancelled' : 'batch_partial_failure',
        error: stderr.trim() || `Process exited with code ${code}`
      })
    })
    child.on('error', (err) => {
      batchProcesses.delete(opts.batch_id)
      resolve({
        ok: false,
        batchId: opts.batch_id,
        failureCode: 'model_unavailable',
        error: err.message
      })
    })

    child.stdin?.write(Buffer.from(JSON.stringify(opts), 'utf-8'))
    child.stdin?.end()
  })
}

app.whenReady().then(async () => {
  await loadStore()

  electronApp.setAppUserModelId('com.lumincrypt.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  ipcMain.handle('store:getAll', () => ({ ...storeCache }))
  ipcMain.handle('store:get', (_e, key: string) => {
    const sanitized = sanitizeStoreKey(key)
    if (!sanitized) return undefined
    return storeCache[sanitized]
  })
  ipcMain.handle('store:set', async (_e, key: string, value: unknown) => {
    const sanitized = sanitizeStoreKey(key)
    if (!sanitized) return
    storeCache[sanitized] = value
    await saveStore()
  })

  ipcMain.handle('clipboard:read', () => clipboard.readText())

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
        filters
      })
      if (canceled || !filePath) return { success: false, error: 'Canceled' }

      try {
        if (ext === 'json') await writeFile(filePath, content, 'utf-8')
        else await writeFile(filePath, Buffer.from(content, 'base64'))
        return { success: true, filePath }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

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
      title: 'Save CSV',
      defaultPath: defaultName,
      filters: [{ name: 'CSV File', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { success: false, error: 'Canceled' }

    try {
      await writeFile(filePath, '\uFEFF' + content, 'utf-8')
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

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
      title: 'Save PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { success: false, error: 'Canceled' }

    const pdfWin = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true }
    })
    try {
      await pdfWin.loadURL(`data:text/html;base64,${htmlB64}`)
      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4'
      })
      await writeFile(filePath, pdfData)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    } finally {
      pdfWin.destroy()
    }
  })

  ipcMain.handle('image-wm:checkPython', async () => {
    return warmupBwmBackend(false)
  })

  ipcMain.handle('image-wm:backendStatus', async () => {
    return backendStatusCache ?? warmupBwmBackend(false)
  })

  ipcMain.handle('image-wm:warmup', async () => {
    return warmupBwmBackend(true)
  })

  ipcMain.handle('image-wm:openImage', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('image-wm:openImages', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return []
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return canceled ? [] : filePaths.filter(isAllowedImagePath)
  })

  ipcMain.handle('image-wm:saveImage', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save watermarked image',
      defaultPath: 'watermarked.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })
    return canceled || !filePath ? null : filePath
  })

  ipcMain.handle('image-wm:chooseOutputDir', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose output folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle(
    'image-wm:embed',
    async (
      _e,
      opts: {
        inputPath: string
        outputPath: string
        wmText: string
        password: number
        quality: string
        engine: string
        payloadMode?: string
      }
    ) => {
      const payloadMode = opts?.payloadMode ?? 'fingerprint64'
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
        !ALLOWED_ENGINE.has(opts.engine) ||
        !ALLOWED_PAYLOAD_MODE.has(payloadMode) ||
        !isAllowedImagePath(opts.inputPath) ||
        !isAllowedImagePath(opts.outputPath)
      ) {
        return { ok: false, error: 'Invalid image embed parameters' }
      }
      const runner = await getRunner()
      if (!runner) return { ok: false, error: 'No runnable image watermark backend available' }
      return runBwm(runner, {
        mode: 'embed',
        input: opts.inputPath,
        output: opts.outputPath,
        wm: opts.wmText,
        password: opts.password,
        quality: opts.quality,
        engine: opts.engine,
        payload_mode: payloadMode,
        models_dir: findBundledModelsDir()
      })
    }
  )

  ipcMain.handle(
    'image-wm:extract',
    async (
      _e,
      opts: {
        inputPath: string
        password: number
        quality: string
        engine: string
        payloadMode?: string
      }
    ) => {
      const payloadMode = opts?.payloadMode
      if (
        !opts ||
        !isValidPathInput(opts.inputPath) ||
        !Number.isInteger(opts.password) ||
        opts.password < 0 ||
        opts.password > 2_147_483_647 ||
        !ALLOWED_QUALITY.has(opts.quality) ||
        !ALLOWED_ENGINE.has(opts.engine) ||
        (payloadMode != null && !ALLOWED_PAYLOAD_MODE.has(payloadMode)) ||
        !isAllowedImagePath(opts.inputPath)
      ) {
        return { ok: false, error: 'Invalid image extract parameters' }
      }
      const runner = await getRunner()
      if (!runner) return { ok: false, error: 'No runnable image watermark backend available' }
      return runBwm(runner, {
        mode: 'extract',
        input: opts.inputPath,
        password: opts.password,
        quality: opts.quality || 'balanced',
        engine: opts.engine,
        payload_mode: payloadMode,
        models_dir: findBundledModelsDir()
      })
    }
  )

  ipcMain.handle(
    'image-wm:embedBatch',
    async (
      e,
      opts: {
        inputPaths: string[]
        outputDir: string
        wmText: string
        password: number
        quality: string
        engine: string
        payloadMode?: string
        selfCheckMode?: 'sampled' | 'all' | 'off'
      }
    ) => {
      const payloadMode = opts?.payloadMode ?? 'fingerprint64'
      if (
        !opts ||
        !Array.isArray(opts.inputPaths) ||
        opts.inputPaths.length === 0 ||
        opts.inputPaths.length > 500 ||
        !isValidPathInput(opts.outputDir) ||
        typeof opts.wmText !== 'string' ||
        opts.wmText.trim().length === 0 ||
        opts.wmText.length > 4096 ||
        !Number.isInteger(opts.password) ||
        opts.password < 0 ||
        opts.password > 2_147_483_647 ||
        !ALLOWED_QUALITY.has(opts.quality) ||
        !ALLOWED_ENGINE.has(opts.engine) ||
        !ALLOWED_PAYLOAD_MODE.has(payloadMode)
      ) {
        return {
          ok: false,
          error: 'Invalid image batch embed parameters',
          failureCode: 'invalid_request'
        }
      }
      const runner = await getRunner()
      if (!runner)
        return {
          ok: false,
          error: 'No runnable image watermark backend available',
          failureCode: 'model_unavailable'
        }
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const usedNames = new Set<string>()
      const lastIndex = opts.inputPaths.length - 1
      const mode = opts.selfCheckMode ?? 'sampled'
      const items = opts.inputPaths.map((inputPath, index) => {
        const selfCheck =
          mode === 'all' ||
          (mode === 'sampled' && (index === 0 || index === lastIndex || index % 10 === 0))
        return {
          input: inputPath,
          output: uniqueBatchOutputPath(inputPath, opts.outputDir, usedNames),
          self_check: selfCheck
        }
      })
      if (
        !items.every(
          (item) =>
            isValidPathInput(item.input) &&
            isAllowedImagePath(item.input) &&
            isAllowedImagePath(item.output)
        )
      ) {
        return { ok: false, error: 'Invalid image path in batch', failureCode: 'invalid_request' }
      }
      return runBwmBatch(
        runner,
        {
          mode: 'embed_batch',
          batch_id: batchId,
          items,
          wm: opts.wmText,
          password: opts.password,
          quality: opts.quality,
          engine: opts.engine,
          payload_mode: payloadMode,
          models_dir: findBundledModelsDir()
        },
        e.sender
      )
    }
  )

  ipcMain.handle('image-wm:cancelBatch', async (_e, batchId: string) => {
    if (typeof batchId !== 'string') return false
    const batch = batchProcesses.get(batchId)
    if (!batch) return false
    const killed = batch.cancel()
    batchProcesses.delete(batchId)
    return killed
  })

  createWindow()
  setTimeout(() => {
    void warmupBwmBackend(true)
  }, 800)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
