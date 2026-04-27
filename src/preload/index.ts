import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type SaveResult = { success: boolean; filePath?: string; error?: string }
type RunnerMode = 'exe' | 'python'
type WatermarkEngine = 'auto' | 'legacy' | 'neural'
type WatermarkQuality = 'invisible' | 'balanced' | 'robust'

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
  engineUsed?: WatermarkEngine | 'legacy'
  fallbackUsed?: boolean
  confidence?: number
  diagnostics?: Record<string, unknown>
}

type ImageWmExtractResult = {
  ok: boolean
  wm?: string
  error?: string
  engineUsed?: WatermarkEngine | 'legacy'
  fallbackUsed?: boolean
  confidence?: number
  diagnostics?: Record<string, unknown>
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
  storeSet: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke('store:set', key, value),
  storeGetAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),

  imageWmCheckPython: (): Promise<ImageWmCheckResult> => ipcRenderer.invoke('image-wm:checkPython'),
  imageWmOpenImage: (): Promise<string | null> => ipcRenderer.invoke('image-wm:openImage'),
  imageWmSaveImage: (): Promise<string | null> => ipcRenderer.invoke('image-wm:saveImage'),
  imageWmEmbed: (opts: {
    inputPath: string
    outputPath: string
    wmText: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
  }): Promise<ImageWmEmbedResult> => ipcRenderer.invoke('image-wm:embed', opts),
  imageWmExtract: (opts: {
    inputPath: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
  }): Promise<ImageWmExtractResult> => ipcRenderer.invoke('image-wm:extract', opts),
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
