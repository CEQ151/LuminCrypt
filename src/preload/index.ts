import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type SaveResult = { success: boolean; filePath?: string; error?: string }
type RunnerMode = 'exe' | 'python'
type WatermarkEngine = 'auto' | 'legacy' | 'neural'
type WatermarkQuality = 'trace' | 'faint' | 'light' | 'invisible' | 'balanced' | 'strong' | 'robust'
type ImagePayloadMode = 'fingerprint64' | 'text16'

type ImageWmCheckResult = {
  ok: boolean
  mode?: RunnerMode
  python: string | null
  hasLib?: boolean
  version?: string
  error?: string
  neuralRuntimeAvailable?: boolean
  neuralModelsAvailable?: boolean
  neuralReady?: boolean
  neuralModelVersion?: string | null
}

type ImageWmEmbedResult = {
  ok: boolean
  output?: string
  quality?: string
  error?: string
  failureCode?: string
  userMessage?: string
  recoveryHints?: string[]
  warningCode?: string
  warnings?: string[]
  engineUsed?: WatermarkEngine | 'legacy'
  fallbackUsed?: boolean
  confidence?: number
  diagnostics?: Record<string, unknown>
  payloadMode?: ImagePayloadMode
  fingerprint?: string
  codec?: string
  berEstimate?: number
  spreadConfidence?: number
}

type ImageWmExtractResult = {
  ok: boolean
  wm?: string
  error?: string
  failureCode?: string
  userMessage?: string
  recoveryHints?: string[]
  engineUsed?: WatermarkEngine | 'legacy'
  fallbackUsed?: boolean
  confidence?: number
  diagnostics?: Record<string, unknown>
  payloadMode?: ImagePayloadMode
  fingerprint?: string
  codec?: string
  berEstimate?: number
  spreadConfidence?: number
}

type ImageWmBatchResult = {
  ok: boolean
  batchId?: string
  total?: number
  successCount?: number
  failureCount?: number
  failureCode?: string | null
  error?: string
  results?: ImageWmEmbedResult[]
}

type ImageWmBatchProgress = {
  event?: 'progress' | 'complete'
  batchId: string
  index?: number
  total?: number
  input?: string
  output?: string
  status?: 'running' | 'done' | 'failed'
  progress?: number
  failureCode?: string
  error?: string
}

const api = {
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  saveFile: (content: string, ext: 'json' | 'pdf', defaultName: string): Promise<SaveResult> =>
    ipcRenderer.invoke('dialog:saveFile', content, ext, defaultName),
  saveCSV: (content: string, defaultName: string): Promise<SaveResult> =>
    ipcRenderer.invoke('dialog:saveCSV', content, defaultName),
  exportPDF: (htmlB64: string, defaultName: string): Promise<SaveResult> =>
    ipcRenderer.invoke('dialog:exportPDF', htmlB64, defaultName),
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  storeGet: (key: string): Promise<unknown> => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('store:set', key, value),
  storeGetAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),

  imageWmCheckPython: (): Promise<ImageWmCheckResult> => ipcRenderer.invoke('image-wm:checkPython'),
  imageWmBackendStatus: (): Promise<ImageWmCheckResult> =>
    ipcRenderer.invoke('image-wm:backendStatus'),
  imageWmWarmup: (): Promise<ImageWmCheckResult> => ipcRenderer.invoke('image-wm:warmup'),
  imageWmOpenImage: (): Promise<string | null> => ipcRenderer.invoke('image-wm:openImage'),
  imageWmOpenImages: (): Promise<string[]> => ipcRenderer.invoke('image-wm:openImages'),
  imageWmSaveImage: (): Promise<string | null> => ipcRenderer.invoke('image-wm:saveImage'),
  imageWmChooseOutputDir: (): Promise<string | null> =>
    ipcRenderer.invoke('image-wm:chooseOutputDir'),
  imageWmEmbed: (opts: {
    inputPath: string
    outputPath: string
    wmText: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
    payloadMode?: ImagePayloadMode
  }): Promise<ImageWmEmbedResult> => ipcRenderer.invoke('image-wm:embed', opts),
  imageWmExtract: (opts: {
    inputPath: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
    payloadMode?: ImagePayloadMode
  }): Promise<ImageWmExtractResult> => ipcRenderer.invoke('image-wm:extract', opts),
  imageWmEmbedBatch: (opts: {
    inputPaths: string[]
    outputDir: string
    wmText: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
    payloadMode?: ImagePayloadMode
    selfCheckMode?: 'sampled' | 'all' | 'off'
  }): Promise<ImageWmBatchResult> => ipcRenderer.invoke('image-wm:embedBatch', opts),
  imageWmCancelBatch: (batchId: string): Promise<boolean> =>
    ipcRenderer.invoke('image-wm:cancelBatch', batchId),
  onImageWmBatchProgress: (callback: (payload: ImageWmBatchProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ImageWmBatchProgress): void =>
      callback(payload)
    ipcRenderer.on('image-wm:batch-progress', listener)
    return (): void => {
      ipcRenderer.removeListener('image-wm:batch-progress', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
