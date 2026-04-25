import {
  Category,
  ZERO_WIDTH_CHARS,
  BIDI_CONTROL_CHARS,
  SPECIAL_SPACE_CHARS,
  isTagsBlock,
  getTagsBlockName,
  isVariationSelector,
  getVariationSelectorName,
  TYPO_PUNCT_MAP,
  STRAIGHT_DOUBLE_QUOTE,
  STRAIGHT_SINGLE_QUOTE,
} from './categories'
import { HOMOGLYPH_MAP } from './homoglyphs'

export interface Finding {
  index: number        // character index in Array.from(text)
  byteOffset: number   // approximate byte offset (for display)
  codePoint: number    // Unicode code point
  char: string         // the actual character
  category: Category
  label: string        // human-readable label
  description: string  // detailed description
  latinEquivalent?: string // for homoglyphs
  script?: string          // for homoglyphs
}

export interface CategoryStats {
  category: Category
  count: number
  findings: Finding[]
}

export interface ScanResult {
  findings: Finding[]
  stats: Map<Category, CategoryStats>
  riskScore: number        // 0–100
  totalChars: number
  suspiciousCount: number
  scanDurationMs: number
}

function calculateRiskScore(findings: Finding[], totalChars: number): number {
  if (findings.length === 0) return 0

  let score = 0

  // Base score from finding count (logarithmic)
  const baseScore = Math.min(40, Math.log(findings.length + 1) * 14)
  score += baseScore

  // Category-weighted bonuses
  const categoryWeights: Record<Category, number> = {
    [Category.TAGS_BLOCK]: 35,    // High risk – designed specifically for watermarking
    [Category.ZERO_WIDTH]: 25,
    [Category.CONTROL_BIDI]: 20,
    [Category.VARIATION_SELECTOR]: 20,  // High risk – invisible, frequently used for watermarking
    [Category.HOMOGLYPH]: 15,
    [Category.SPECIAL_SPACE]: 5,
    [Category.TYPO_PUNCT]: 3,    // Low risk – typographic punctuation / AI straight-quote artifact
  }

  const catCounts = new Map<Category, number>()
  for (const f of findings) {
    catCounts.set(f.category, (catCounts.get(f.category) ?? 0) + 1)
  }

  for (const [cat, count] of catCounts) {
    if (count > 0) {
      score += categoryWeights[cat] * Math.min(1, count / 3)
    }
  }

  // Density penalty (suspicious chars per 1000 chars)
  const density = (findings.length / Math.max(totalChars, 1)) * 1000
  score += Math.min(10, density * 2)

  return Math.min(100, Math.round(score))
}

export function scan(text: string): ScanResult {
  const start = performance.now()
  const chars = Array.from(text) // handles surrogate pairs correctly
  const findings: Finding[] = []
  const stats = new Map<Category, CategoryStats>()

  let byteOffset = 0

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const cp = ch.codePointAt(0)!
    let finding: Finding | null = null

    if (ZERO_WIDTH_CHARS.has(cp)) {
      finding = {
        index: i,
        byteOffset,
        codePoint: cp,
        char: ch,
        category: Category.ZERO_WIDTH,
        label: getCharName(cp, Category.ZERO_WIDTH),
        description: `Invisible zero-width character (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`,
      }
    } else if (BIDI_CONTROL_CHARS.has(cp)) {
      finding = {
        index: i,
        byteOffset,
        codePoint: cp,
        char: ch,
        category: Category.CONTROL_BIDI,
        label: getCharName(cp, Category.CONTROL_BIDI),
        description: `BiDi control character that can alter text rendering direction (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`,
      }
    } else if (SPECIAL_SPACE_CHARS.has(cp)) {
      finding = {
        index: i,
        byteOffset,
        codePoint: cp,
        char: ch,
        category: Category.SPECIAL_SPACE,
        label: getCharName(cp, Category.SPECIAL_SPACE),
        description: `Non-standard space variant (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) — visually identical to regular space`,
      }
    } else if (isTagsBlock(cp)) {
      finding = {
        index: i,
        byteOffset,
        codePoint: cp,
        char: ch,
        category: Category.TAGS_BLOCK,
        label: getTagsBlockName(cp),
        description: `Tags block character (U+${cp.toString(16).toUpperCase()}) — Unicode Tags used as AI watermarks`,
      }
    } else if (isVariationSelector(cp)) {
      finding = {
        index: i,
        byteOffset,
        codePoint: cp,
        char: ch,
        category: Category.VARIATION_SELECTOR,
        label: getVariationSelectorName(cp),
        description: `Variation Selector (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) — invisible modifier that can carry hidden fingerprint data`,
      }
    } else {
      // TYPO_PUNCT: dashes used as hyphen substitute
      const typoPunct = TYPO_PUNCT_MAP.get(cp)
      if (typoPunct) {
        finding = {
          index: i,
          byteOffset,
          codePoint: cp,
          char: ch,
          category: Category.TYPO_PUNCT,
          label: typoPunct.unicodeName,
          description: `${typoPunct.description} (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) — 可能为 AI 内容生成痕迹`,
          latinEquivalent: typoPunct.ascii,
        }
      } else {
        // TYPO_PUNCT: ASCII straight quotes are always suspicious.
        // Smart editors and CJK IMEs produce curly quotes automatically;
        // raw straight quotes are a common AI-generation artifact.
        const isStraightQ = cp === STRAIGHT_DOUBLE_QUOTE || cp === STRAIGHT_SINGLE_QUOTE
        if (isStraightQ) {
          const qType = cp === STRAIGHT_DOUBLE_QUOTE ? '双引号' : '单引号'
          finding = {
            index: i,
            byteOffset,
            codePoint: cp,
            char: ch,
            category: Category.TYPO_PUNCT,
            label: cp === STRAIGHT_DOUBLE_QUOTE ? 'ASCII STRAIGHT DOUBLE QUOTE' : 'ASCII STRAIGHT SINGLE QUOTE',
            description: `竖线形${qType} (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) — 正常输入法/编辑器会自动生成弯引号，此竖线形引号疑似 AI 生成痕迹`,
            latinEquivalent: cp === STRAIGHT_DOUBLE_QUOTE ? '“”' : '‘’',
          }
        }

        // HOMOGLYPH (existing logic)
        if (!finding) {
          const homoglyph = HOMOGLYPH_MAP.get(cp)
          if (homoglyph) {
            finding = {
              index: i,
              byteOffset,
              codePoint: cp,
              char: ch,
              category: Category.HOMOGLYPH,
              label: homoglyph.unicodeName,
              description: `${homoglyph.script} character that looks identical to Latin "${homoglyph.latin}"`,
              latinEquivalent: homoglyph.latin,
              script: homoglyph.script,
            }
          }
        }
      }
    }

    if (finding) {
      findings.push(finding)
      if (!stats.has(finding.category)) {
        stats.set(finding.category, { category: finding.category, count: 0, findings: [] })
      }
      const catStat = stats.get(finding.category)!
      catStat.count++
      catStat.findings.push(finding)
    }

    byteOffset += ch.length // surrogate pairs = 2 UTF-16 code units
  }

  const scanDurationMs = performance.now() - start
  const riskScore = calculateRiskScore(findings, chars.length)

  return {
    findings,
    stats,
    riskScore,
    totalChars: chars.length,
    suspiciousCount: findings.length,
    scanDurationMs,
  }
}

function getCharName(cp: number, category: Category): string {
  const names: Record<number, string> = {
    0x200b: 'ZERO WIDTH SPACE',
    0x200c: 'ZERO WIDTH NON-JOINER',
    0x200d: 'ZERO WIDTH JOINER',
    0xfeff: 'ZERO WIDTH NO-BREAK SPACE / BOM',
    0x2060: 'WORD JOINER',
    0x2061: 'FUNCTION APPLICATION',
    0x2062: 'INVISIBLE TIMES',
    0x2063: 'INVISIBLE SEPARATOR',
    0x2064: 'INVISIBLE PLUS',
    0x180e: 'MONGOLIAN VOWEL SEPARATOR',
    0x034f: 'COMBINING GRAPHEME JOINER',
    0x200e: 'LEFT-TO-RIGHT MARK',
    0x200f: 'RIGHT-TO-LEFT MARK',
    0x202a: 'LEFT-TO-RIGHT EMBEDDING',
    0x202b: 'RIGHT-TO-LEFT EMBEDDING',
    0x202c: 'POP DIRECTIONAL FORMATTING',
    0x202d: 'LEFT-TO-RIGHT OVERRIDE',
    0x202e: 'RIGHT-TO-LEFT OVERRIDE',
    0x2066: 'LEFT-TO-RIGHT ISOLATE',
    0x2067: 'RIGHT-TO-LEFT ISOLATE',
    0x2068: 'FIRST STRONG ISOLATE',
    0x2069: 'POP DIRECTIONAL ISOLATE',
    0x00a0: 'NO-BREAK SPACE',
    0x2000: 'EN QUAD',
    0x2001: 'EM QUAD',
    0x2002: 'EN SPACE',
    0x2003: 'EM SPACE',
    0x2004: 'THREE-PER-EM SPACE',
    0x2005: 'FOUR-PER-EM SPACE',
    0x2006: 'SIX-PER-EM SPACE',
    0x2007: 'FIGURE SPACE',
    0x2008: 'PUNCTUATION SPACE',
    0x2009: 'THIN SPACE',
    0x200a: 'HAIR SPACE',
    0x202f: 'NARROW NO-BREAK SPACE',
    0x205f: 'MEDIUM MATHEMATICAL SPACE',
    0x3000: 'IDEOGRAPHIC SPACE',
  }
  return names[cp] ?? `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${category})`
}
