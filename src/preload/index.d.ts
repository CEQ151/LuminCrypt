import { ElectronAPI } from '@electron-toolkit/preload'

type SaveResult = { success: boolean; filePath?: string; error?: string }

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

  // Image blind watermark
  imageWmCheckPython: () => Promise<{ ok: boolean; mode?: 'exe' | 'python'; python: string | null; hasLib?: boolean; version?: string; error?: string }>
  imageWmOpenImage: () => Promise<string | null>
  imageWmSaveImage: () => Promise<string | null>
  imageWmEmbed: (opts: {
    inputPath: string
    outputPath: string
    wmText: string
    password: number
    quality: string
  }) => Promise<{ ok: boolean; output?: string; quality?: string; error?: string }>
  imageWmExtract: (opts: {
    inputPath: string
    password: number
  }) => Promise<{ ok: boolean; wm?: string; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
