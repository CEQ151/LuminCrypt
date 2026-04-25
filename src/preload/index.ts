import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type SaveResult = { success: boolean; filePath?: string; error?: string }

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

  // ── Image blind watermark ──────────────────────────────────────────────────
  imageWmCheckPython: (): Promise<{ ok: boolean; mode?: 'exe' | 'python'; python: string | null; hasLib?: boolean; version?: string; error?: string }> =>
    ipcRenderer.invoke('image-wm:checkPython'),
  imageWmOpenImage: (): Promise<string | null> =>
    ipcRenderer.invoke('image-wm:openImage'),
  imageWmSaveImage: (): Promise<string | null> =>
    ipcRenderer.invoke('image-wm:saveImage'),
  imageWmEmbed: (opts: {
    inputPath: string
    outputPath: string
    wmText: string
    password: number
    quality: string
  }): Promise<{ ok: boolean; output?: string; quality?: string; error?: string }> =>
    ipcRenderer.invoke('image-wm:embed', opts),
  imageWmExtract: (opts: {
    inputPath: string
    password: number
  }): Promise<{ ok: boolean; wm?: string; error?: string }> =>
    ipcRenderer.invoke('image-wm:extract', opts),
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
