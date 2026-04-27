import { ElectronAPI } from '@electron-toolkit/preload'

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
  imageWmBackendStatus: () => Promise<ImageWmCheckResult>
  imageWmWarmup: () => Promise<ImageWmCheckResult>
  imageWmOpenImage: () => Promise<string | null>
  imageWmOpenImages: () => Promise<string[]>
  imageWmSaveImage: () => Promise<string | null>
  imageWmChooseOutputDir: () => Promise<string | null>
  imageWmEmbed: (opts: {
    inputPath: string
    outputPath: string
    wmText: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
    payloadMode?: ImagePayloadMode
  }) => Promise<ImageWmEmbedResult>
  imageWmExtract: (opts: {
    inputPath: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
    payloadMode?: ImagePayloadMode
  }) => Promise<ImageWmExtractResult>
  imageWmEmbedBatch: (opts: {
    inputPaths: string[]
    outputDir: string
    wmText: string
    password: number
    quality: WatermarkQuality
    engine: WatermarkEngine
    payloadMode?: ImagePayloadMode
    selfCheckMode?: 'sampled' | 'all' | 'off'
  }) => Promise<ImageWmBatchResult>
  imageWmCancelBatch: (batchId: string) => Promise<boolean>
  onImageWmBatchProgress: (callback: (payload: ImageWmBatchProgress) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
