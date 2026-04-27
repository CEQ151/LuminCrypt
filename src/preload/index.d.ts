import { ElectronAPI } from '@electron-toolkit/preload'

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

interface AppAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  saveFile: (content: string, ext: 'json' | 'pdf', defaultName: string) => Promise<SaveResult>
  saveCSV: (content: string, defaultName: string) => Promise<SaveResult>
  exportPDF: (htmlB64: string, defaultName: string) => Promise<SaveResult>
  readClipboard: () => Promise<string>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeGetAll: () => Promise<Record<string, unknown>>
  imageWmCheckPython: () => Promise<ImageWmCheckResult>
  imageWmOpenImage: () => Promise<string | null>
  imageWmSaveImage: () => Promise<string | null>
  imageWmEmbed: (opts: {
    inputPath: string
    outputPath: string
    wmText: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
  }) => Promise<ImageWmEmbedResult>
  imageWmExtract: (opts: {
    inputPath: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
  }) => Promise<ImageWmExtractResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
