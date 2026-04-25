import { decodeWatermark, embedWatermark } from './watermark'

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), 61 | t))) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dropRandomChars(text: string, dropRatio: number, seed = 1337): string {
  const rng = mulberry32(seed)
  const chars = Array.from(text)
  return chars.filter(() => rng() >= dropRatio).join('')
}

export async function runWatermarkRobustnessProbe(): Promise<{
  ratio: number
  success: boolean
  confidence?: number
  error?: string
}[]> {
  const hostText = '这是用于鲁棒性测试的宿主文本。'.repeat(320)
  const message = 'TRACE-ID:LC-2026-ROBUST-PROBE'
  const key = 'probe-key'

  const { watermarked } = await embedWatermark({
    message,
    hostText,
    key,
    robust: true,
    profile: 'strong',
  })

  const ratios = [0.1, 0.2, 0.3]
  const out: { ratio: number; success: boolean; confidence?: number; error?: string }[] = []
  for (const ratio of ratios) {
    const damaged = dropRandomChars(watermarked, ratio, 1000 + Math.floor(ratio * 100))
    const decoded = await decodeWatermark(damaged, key)
    out.push({
      ratio,
      success: decoded.success,
      confidence: decoded.confidence,
      error: decoded.error,
    })
  }
  return out
}

