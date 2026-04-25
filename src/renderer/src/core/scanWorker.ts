import { scan, ScanResult } from './detector'

interface ScanRequest {
  id: number
  text: string
}

interface ScanSuccess {
  id: number
  ok: true
  result: ScanResult
}

interface ScanFailure {
  id: number
  ok: false
  error: string
}

type ScanResponse = ScanSuccess | ScanFailure

self.onmessage = (event: MessageEvent<ScanRequest>) => {
  const { id, text } = event.data
  try {
    const result = scan(text)
    const payload: ScanResponse = { id, ok: true, result }
    self.postMessage(payload)
  } catch (error) {
    const payload: ScanResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(payload)
  }
}
