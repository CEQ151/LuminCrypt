import { scan, ScanResult } from './detector'

type Pending = {
  resolve: (result: ScanResult) => void
  reject: (error: Error) => void
}

type WorkerResponse =
  | { id: number; ok: true; result: ScanResult }
  | { id: number; ok: false; error: string }

let worker: Worker | null = null
let reqId = 0
const pending = new Map<number, Pending>()

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  try {
    worker = new Worker(new URL('./scanWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      const task = pending.get(msg.id)
      if (!task) return
      pending.delete(msg.id)
      if (msg.ok) {
        task.resolve(msg.result)
      } else {
        task.reject(new Error(msg.error))
      }
    }
    worker.onerror = (event: ErrorEvent) => {
      const err = new Error(event.message || 'Scan worker crashed')
      for (const [, task] of pending) task.reject(err)
      pending.clear()
      worker?.terminate()
      worker = null
    }
    return worker
  } catch {
    // Worker creation failed (e.g. CSP restrictions, file:// protocol, etc.)
    // Gracefully fallback to main-thread scanning
    worker = null
    return null
  }
}

export function scanAsync(text: string): Promise<ScanResult> {
  const w = ensureWorker()
  if (!w) return Promise.resolve(scan(text))

  return new Promise<ScanResult>((resolve, reject) => {
    const id = ++reqId
    pending.set(id, { resolve, reject })
    w.postMessage({ id, text })
  })
}

export function terminateScanWorker(): void {
  if (!worker) return
  worker.terminate()
  worker = null
  for (const [, task] of pending) task.reject(new Error('Scan worker terminated'))
  pending.clear()
}
