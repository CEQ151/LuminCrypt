import { useState, useCallback } from 'react'
import { embedWatermark, decodeWatermark, EmbedResult, DecodeResult, CarrierClass } from '../core/watermark'
import { poisonText, PoisonOptions, PoisonResult } from '../core/poisoner'

// ---- Watermark embed/decode state ----
export type WatermarkStatus = 'idle' | 'working' | 'done' | 'error'

export interface UseWatermarkReturn {
  // Embed
  embedStatus: WatermarkStatus
  embedResult: EmbedResult | null
  embedError: string | null
  runEmbed: (
    message: string,
    hostText: string,
    key?: string,
    options?: { robust?: boolean; redundancy?: number; profile?: 'balanced' | 'strong'; carrierClasses?: CarrierClass[] }
  ) => void

  // Decode
  decodeStatus: WatermarkStatus
  decodeResult: DecodeResult | null
  runDecode: (text: string, key?: string) => void

  // Poison
  poisonStatus: WatermarkStatus
  poisonResult: PoisonResult | null
  poisonError: string | null
  runPoison: (text: string, options: PoisonOptions) => void

  resetAll: () => void
}

export function useWatermark(): UseWatermarkReturn {
  const [embedStatus, setEmbedStatus] = useState<WatermarkStatus>('idle')
  const [embedResult, setEmbedResult] = useState<EmbedResult | null>(null)
  const [embedError, setEmbedError] = useState<string | null>(null)

  const [decodeStatus, setDecodeStatus] = useState<WatermarkStatus>('idle')
  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null)

  const [poisonStatus, setPoisonStatus] = useState<WatermarkStatus>('idle')
  const [poisonResult, setPoisonResult] = useState<PoisonResult | null>(null)
  const [poisonError, setPoisonError] = useState<string | null>(null)

  const runEmbed = useCallback((
    message: string,
    hostText: string,
    key?: string,
    options?: { robust?: boolean; redundancy?: number; profile?: 'balanced' | 'strong'; carrierClasses?: CarrierClass[] },
  ) => {
    if (!message.trim() || !hostText.trim()) return
    setEmbedStatus('working')
    setEmbedResult(null)
    setEmbedError(null)
    ;(async () => {
      try {
        const result = await embedWatermark({
          message,
          hostText,
          key: key?.trim() || undefined,
          robust: options?.robust,
          redundancy: options?.redundancy,
          profile: options?.profile,
          carrierClasses: options?.carrierClasses,
        })
        setEmbedResult(result)
        setEmbedStatus('done')
      } catch (err) {
        setEmbedError(err instanceof Error ? err.message : 'Embed failed')
        setEmbedStatus('error')
      }
    })()
  }, [])

  const runDecode = useCallback((text: string, key?: string) => {
    if (!text.trim()) return
    setDecodeStatus('working')
    setDecodeResult(null)
    ;(async () => {
      try {
        const result = await decodeWatermark(text, key?.trim() || undefined)
        setDecodeResult(result)
        setDecodeStatus('done')
      } catch (err) {
        setDecodeResult({ success: false, error: err instanceof Error ? err.message : 'Decode failed' })
        setDecodeStatus('done')
      }
    })()
  }, [])

  const runPoison = useCallback((text: string, options: PoisonOptions) => {
    if (!text.trim()) return
    setPoisonStatus('working')
    setPoisonResult(null)
    setPoisonError(null)
    try {
      const result = poisonText(text, options)
      setPoisonResult(result)
      setPoisonStatus('done')
    } catch (err) {
      setPoisonError(err instanceof Error ? err.message : 'Poison failed')
      setPoisonStatus('error')
    }
  }, [])

  const resetAll = useCallback(() => {
    setEmbedStatus('idle')
    setEmbedResult(null)
    setEmbedError(null)
    setDecodeStatus('idle')
    setDecodeResult(null)
    setPoisonStatus('idle')
    setPoisonResult(null)
    setPoisonError(null)
  }, [])

  return {
    embedStatus, embedResult, embedError, runEmbed,
    decodeStatus, decodeResult, runDecode,
    poisonStatus, poisonResult, poisonError, runPoison,
    resetAll,
  }
}
