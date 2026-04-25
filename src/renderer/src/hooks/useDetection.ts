import { useState, useCallback, useRef } from 'react'
import { ScanResult } from '../core/detector'
import { cleanByCategory, cleanAll } from '../core/cleaner'
import { Category } from '../core/categories'
import { scanAsync } from '../core/scanWorkerClient'

export type DetectionStatus = 'idle' | 'parsing' | 'scanning' | 'done' | 'error'

export interface UseDetectionReturn {
  status: DetectionStatus
  result: ScanResult | null
  text: string
  cleanedText: string | null
  errorMessage: string | null
  setText: (t: string) => void
  runScan: () => void
  runClean: (categories?: Category[]) => void
  reset: () => void
}

export function useDetection(): UseDetectionReturn {
  const [status, setStatus] = useState<DetectionStatus>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [text, setText] = useState('')
  const [cleanedText, setCleanedText] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef(false)

  const runScan = useCallback(() => {
    if (!text.trim()) return
    abortRef.current = false
    setStatus('scanning')
    setResult(null)
    setCleanedText(null)
    setErrorMessage(null)

    void scanAsync(text)
      .then((scanResult) => {
        if (!abortRef.current) {
          setResult(scanResult)
          setStatus('done')
        }
      })
      .catch((err) => {
        if (!abortRef.current) {
          setErrorMessage(err instanceof Error ? err.message : 'Unknown scan error')
          setStatus('error')
        }
      })
  }, [text])

  const runClean = useCallback(
    (categories?: Category[]) => {
      if (!text) return
      const cleaned = categories ? cleanByCategory(text, categories) : cleanAll(text)
      setCleanedText(cleaned)
    },
    [text]
  )

  const reset = useCallback(() => {
    abortRef.current = true
    setStatus('idle')
    setResult(null)
    setText('')
    setCleanedText(null)
    setErrorMessage(null)
  }, [])

  return {
    status,
    result,
    text,
    cleanedText,
    errorMessage,
    setText,
    runScan,
    runClean,
    reset,
  }
}
