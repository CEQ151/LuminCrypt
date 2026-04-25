// Unicode suspicious character category definitions

export enum Category {
  ZERO_WIDTH = 'ZERO_WIDTH',
  CONTROL_BIDI = 'CONTROL_BIDI',
  SPECIAL_SPACE = 'SPECIAL_SPACE',
  TAGS_BLOCK = 'TAGS_BLOCK',
  HOMOGLYPH = 'HOMOGLYPH',
  VARIATION_SELECTOR = 'VARIATION_SELECTOR',
  TYPO_PUNCT = 'TYPO_PUNCT',
}

export interface CategoryMeta {
  label: string
  description: string
  color: string       // Tailwind bg color class
  textColor: string   // Tailwind text color class
  borderColor: string // Tailwind border color class
  glowColor: string   // CSS color for glow
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  [Category.ZERO_WIDTH]: {
    label: '零宽字符',
    description: '不可见的零宽字符，常用于嵌入隐藏数据',
    color: 'bg-blue-500/20',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/50',
    glowColor: 'rgba(59,130,246,0.6)',
  },
  [Category.CONTROL_BIDI]: {
    label: '双向控制',
    description: '双向文本控制字符，可颠倒文本的视觉显示顺序',
    color: 'bg-red-500/20',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/50',
    glowColor: 'rgba(239,68,68,0.6)',
  },
  [Category.SPECIAL_SPACE]: {
    label: '特殊空格',
    description: '外观与普通空格相同的非标准空白字符',
    color: 'bg-emerald-500/20',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/50',
    glowColor: 'rgba(16,185,129,0.6)',
  },
  [Category.TAGS_BLOCK]: {
    label: 'Tags 水印块',
    description: 'Unicode Tags 区块（U+E0000–U+E007F），常用作 AI 文本水印',
    color: 'bg-violet-500/20',
    textColor: 'text-violet-300',
    borderColor: 'border-violet-500/50',
    glowColor: 'rgba(139,92,246,0.6)',
  },
  [Category.HOMOGLYPH]: {
    label: '同形替换',
    description: '来自其他字符集、与拉丁字母形态相同的字符',
    color: 'bg-amber-500/20',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/50',
    glowColor: 'rgba(245,158,11,0.6)',
  },
  [Category.VARIATION_SELECTOR]: {
    label: '字形选择符',
    description: '不可见的字形修饰符（U+FE00–FE0F、U+E0100–E01EF），可用于隐藏数据编码',
    color: 'bg-cyan-500/20',
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-500/50',
    glowColor: 'rgba(6,182,212,0.6)',
  },
  [Category.TYPO_PUNCT]: {
    label: '排版标点',
    description: '竖线形直引号出现于中文语境，或破折号/负号替代连字符 — 可能为 AI 生成痕迹',
    color: 'bg-orange-500/20',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-500/50',
    glowColor: 'rgba(249,115,22,0.6)',
  },
}

// Zero-width character ranges
export const ZERO_WIDTH_CHARS: Set<number> = new Set([
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM)
  0x2060, // WORD JOINER
  0x2061, // FUNCTION APPLICATION
  0x2062, // INVISIBLE TIMES
  0x2063, // INVISIBLE SEPARATOR
  0x2064, // INVISIBLE PLUS
  0x180e, // MONGOLIAN VOWEL SEPARATOR
  0x034f, // COMBINING GRAPHEME JOINER
])

// BiDi control character ranges
export const BIDI_CONTROL_CHARS: Set<number> = new Set([
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x202a, // LEFT-TO-RIGHT EMBEDDING
  0x202b, // RIGHT-TO-LEFT EMBEDDING
  0x202c, // POP DIRECTIONAL FORMATTING
  0x202d, // LEFT-TO-RIGHT OVERRIDE
  0x202e, // RIGHT-TO-LEFT OVERRIDE
  0x2066, // LEFT-TO-RIGHT ISOLATE
  0x2067, // RIGHT-TO-LEFT ISOLATE
  0x2068, // FIRST STRONG ISOLATE
  0x2069, // POP DIRECTIONAL ISOLATE
])

// Special space variants (not regular U+0020)
export const SPECIAL_SPACE_CHARS: Set<number> = new Set([
  0x00a0, // NO-BREAK SPACE
  0x2000, // EN QUAD
  0x2001, // EM QUAD
  0x2002, // EN SPACE
  0x2003, // EM SPACE
  0x2004, // THREE-PER-EM SPACE
  0x2005, // FOUR-PER-EM SPACE
  0x2006, // SIX-PER-EM SPACE
  0x2007, // FIGURE SPACE
  0x2008, // PUNCTUATION SPACE
  0x2009, // THIN SPACE
  0x200a, // HAIR SPACE
  0x202f, // NARROW NO-BREAK SPACE
  0x205f, // MEDIUM MATHEMATICAL SPACE
  0x3000, // IDEOGRAPHIC SPACE
])

// Variation Selectors (U+FE00–FE0F, VS1–VS16)
export const VARIATION_SELECTOR_CHARS: Set<number> = new Set([
  0xfe00, 0xfe01, 0xfe02, 0xfe03, 0xfe04, 0xfe05, 0xfe06, 0xfe07,
  0xfe08, 0xfe09, 0xfe0a, 0xfe0b, 0xfe0c, 0xfe0d, 0xfe0e, 0xfe0f,
])

// Variation Selectors Supplement (U+E0100–E01EF, VS17–VS256)
export function isVariationSelectorSupplement(cp: number): boolean {
  return cp >= 0xe0100 && cp <= 0xe01ef
}

export function isVariationSelector(cp: number): boolean {
  return VARIATION_SELECTOR_CHARS.has(cp) || isVariationSelectorSupplement(cp)
}

export function getVariationSelectorName(cp: number): string {
  if (cp >= 0xfe00 && cp <= 0xfe0f) {
    return `VARIATION SELECTOR-${cp - 0xfe00 + 1}`
  }
  if (cp >= 0xe0100 && cp <= 0xe01ef) {
    return `VARIATION SELECTOR-${cp - 0xe0100 + 17}`
  }
  return `VARIATION SELECTOR U+${cp.toString(16).toUpperCase()}`
}

// Tags block range
export const TAGS_BLOCK_START = 0xe0000
export const TAGS_BLOCK_END = 0xe007f

export function isTagsBlock(cp: number): boolean {
  return cp >= TAGS_BLOCK_START && cp <= TAGS_BLOCK_END
}

export function getTagsBlockName(cp: number): string {
  const offset = cp - TAGS_BLOCK_START
  if (offset === 0) return 'TAG CANCEL'
  if (offset >= 0x20 && offset <= 0x7e) {
    return `TAG LATIN ${String.fromCodePoint(offset)}`
  }
  return `LANGUAGE TAG U+${cp.toString(16).toUpperCase()}`
}

// ── TYPO_PUNCT: typographic punctuation that may indicate AI-generated text ──

export interface TypoPunctEntry {
  ascii: string        // ASCII/normalized equivalent
  unicodeName: string  // Unicode character name
  description: string  // human-readable description
  kind: 'dash' | 'straight-quote' // sub-type for cleaner
}

// Dashes/minus that are misused as plain hyphen
export const TYPO_PUNCT_MAP: Map<number, TypoPunctEntry> = new Map([
  [0x2013, { ascii: '-',   unicodeName: 'EN DASH',    description: '连字符替代：短破折号',       kind: 'dash' }],
  [0x2014, { ascii: '-',   unicodeName: 'EM DASH',    description: '连字符替代：长破折号',       kind: 'dash' }],
  [0x2212, { ascii: '-',   unicodeName: 'MINUS SIGN', description: '减号（非 ASCII 连字符）',   kind: 'dash' }],
])

// ASCII straight quotes that appear in CJK context are flagged separately
// (stored here as constants for cleaner/detector reference)
export const STRAIGHT_DOUBLE_QUOTE = 0x0022 // "
export const STRAIGHT_SINGLE_QUOTE = 0x0027 // '

/** Returns true if code point is a CJK character */
export function isCJK(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff)   ||
    (cp >= 0x3400 && cp <= 0x4dbf)   ||
    (cp >= 0x2e80 && cp <= 0x2eff)   ||
    (cp >= 0x3000 && cp <= 0x303f)   ||
    (cp >= 0xf900 && cp <= 0xfaff)   ||
    (cp >= 0x20000 && cp <= 0x2a6df)
  )
}

