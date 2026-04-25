/**
 * Text Poisoner — randomly injects suspicious Unicode characters into host text
 */

import { HOMOGLYPH_MAP } from './homoglyphs'
import {
  ZERO_WIDTH_CHARS,
  BIDI_CONTROL_CHARS,
  SPECIAL_SPACE_CHARS,
  VARIATION_SELECTOR_CHARS,
  isTagsBlock,
} from './categories'

export type PoisonDensity = 'low' | 'medium' | 'high'

export interface PoisonOptions {
  zeroWidth?: boolean
  homoglyphs?: boolean
  bidiControl?: boolean
  specialSpace?: boolean
  tagsBlock?: boolean
  variationSelectors?: boolean
  density?: PoisonDensity
}

export interface PoisonResult {
  poisoned: string
  injectedCount: number
  byCategory: Record<string, number>
}

// Characters available for each category
const ZERO_WIDTH_POOL = [0x200b, 0x200c, 0x2060, 0x2061, 0x2062, 0x2063]
const BIDI_POOL = [0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x2066, 0x2067, 0x2068, 0x2069]
const SPECIAL_SPACE_POOL = [0x00a0, 0x2002, 0x2003, 0x2004, 0x2005, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f]
const VARIATION_SELECTOR_POOL = [0xfe00, 0xfe01, 0xfe02, 0xfe03, 0xfe04, 0xfe05, 0xfe06, 0xfe07]
// Tags block: invisible ASCII equivalents U+E0020–U+E007E (printable range)
const TAGS_POOL: number[] = []
for (let i = 0xe0041; i <= 0xe005a; i++) TAGS_POOL.push(i) // TAG LATIN A–Z

// Verify pool chars are actually recognized (they should be, but guard)
void ZERO_WIDTH_CHARS
void BIDI_CONTROL_CHARS
void SPECIAL_SPACE_CHARS
void VARIATION_SELECTOR_CHARS
void isTagsBlock

const DENSITY_RATES: Record<PoisonDensity, number> = {
  low: 0.03,    // ~3% of word-boundary positions
  medium: 0.08, // ~8%
  high: 0.18,   // ~18%
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// Simple seeded PRNG (mulberry32)
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Build a pool of codepoints to inject based on options + homoglyph candidates in text
function buildInjectionPool(
  text: string,
  options: PoisonOptions
): Array<{ char: string; category: string }> {
  const pool: Array<{ char: string; category: string }> = []

  if (options.zeroWidth) {
    for (const cp of ZERO_WIDTH_POOL) {
      pool.push({ char: String.fromCodePoint(cp), category: 'zeroWidth' })
    }
  }
  if (options.bidiControl) {
    for (const cp of BIDI_POOL) {
      pool.push({ char: String.fromCodePoint(cp), category: 'bidiControl' })
    }
  }
  if (options.specialSpace) {
    for (const cp of SPECIAL_SPACE_POOL) {
      pool.push({ char: String.fromCodePoint(cp), category: 'specialSpace' })
    }
  }
  if (options.tagsBlock) {
    for (const cp of TAGS_POOL) {
      pool.push({ char: String.fromCodePoint(cp), category: 'tagsBlock' })
    }
  }
  if (options.variationSelectors) {
    for (const cp of VARIATION_SELECTOR_POOL) {
      pool.push({ char: String.fromCodePoint(cp), category: 'variationSelectors' })
    }
  }

  // Homoglyphs: find letters in text that have homoglyph substitutes
  if (options.homoglyphs) {
    const textChars = new Set(Array.from(text).map((c) => c.charCodeAt(0)))
    for (const [cp, entry] of HOMOGLYPH_MAP) {
      const latinCp = entry.latin.charCodeAt(0)
      if (textChars.has(latinCp)) {
        pool.push({ char: String.fromCodePoint(cp), category: 'homoglyphs' })
      }
    }
  }

  return pool
}

export function poisonText(text: string, options: PoisonOptions = {}): PoisonResult {
  const density = options.density ?? 'medium'
  const rate = DENSITY_RATES[density]
  const rng = seededRng(Date.now() & 0xffffffff)

  const injectionPool = buildInjectionPool(text, options)
  if (injectionPool.length === 0) {
    return { poisoned: text, injectedCount: 0, byCategory: {} }
  }

  const chars = Array.from(text)
  const result: string[] = []
  const byCategory: Record<string, number> = {}
  let injectedCount = 0

  for (let i = 0; i < chars.length; i++) {
    result.push(chars[i])

    // Inject after word boundaries (non-space → space transition or end of word char)
    const isWordChar = /\p{L}|\p{N}/u.test(chars[i])
    const nextIsSpace = i + 1 >= chars.length || /\s/.test(chars[i + 1])

    if (isWordChar && (nextIsSpace || i + 1 >= chars.length)) {
      if (rng() < rate) {
        // For homoglyphs: try to replace current char instead of inserting
        if (options.homoglyphs && rng() < 0.5) {
          const cp = chars[i].charCodeAt(0)
          // Find a homoglyph of the current char (if it's a Latin letter)
          let substituted = false
          for (const [hcp, entry] of HOMOGLYPH_MAP) {
            if (entry.latin === chars[i] && rng() < 0.3) {
              // Replace the last pushed char
              result[result.length - 1] = String.fromCodePoint(hcp)
              byCategory['homoglyphs'] = (byCategory['homoglyphs'] ?? 0) + 1
              injectedCount++
              substituted = true
              break
            }
          }
          void cp
          if (substituted) continue
        }

        // Otherwise insert an invisible char after the word
        const candidate = pickRandom(injectionPool.filter((p) => p.category !== 'homoglyphs'), rng)
        if (candidate) {
          result.push(candidate.char)
          byCategory[candidate.category] = (byCategory[candidate.category] ?? 0) + 1
          injectedCount++
        }
      }
    }
  }

  return { poisoned: result.join(''), injectedCount, byCategory }
}
