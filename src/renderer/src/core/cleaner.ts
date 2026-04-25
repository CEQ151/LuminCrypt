import { Category } from './categories'
import { HOMOGLYPH_MAP } from './homoglyphs'
import {
  ZERO_WIDTH_CHARS,
  BIDI_CONTROL_CHARS,
  SPECIAL_SPACE_CHARS,
  isTagsBlock,
  isVariationSelector,
  TYPO_PUNCT_MAP,
  STRAIGHT_DOUBLE_QUOTE,
  STRAIGHT_SINGLE_QUOTE,
  isCJK,
} from './categories'

export interface CleanOptions {
  removeZeroWidth?: boolean
  removeBidiControl?: boolean
  removeSpecialSpace?: boolean  // replaces with regular space
  removeTagsBlock?: boolean
  removeHomoglyphs?: boolean    // replaces with Latin equivalent
  removeVariationSelectors?: boolean
  normalizeTypoPunct?: boolean  // replaces en-dash/em-dash/minus with hyphen
  normalizeQuotes?: boolean     // replaces ASCII straight quotes with typographic curly quotes
}

export function clean(text: string, options: CleanOptions = {}): string {
  const {
    removeZeroWidth = true,
    removeBidiControl = true,
    removeSpecialSpace = false,
    removeTagsBlock = true,
    removeHomoglyphs = false,
    removeVariationSelectors = true,
    normalizeTypoPunct = false,
    normalizeQuotes = false,
  } = options

  // Pass 1: quote normalization (needs full context for open/close pairing)
  const workText = normalizeQuotes ? normalizeASCIIQuotes(text) : text
  const chars = Array.from(workText)
  const result: string[] = []

  for (const ch of chars) {
    const cp = ch.codePointAt(0)!

    if (removeZeroWidth && ZERO_WIDTH_CHARS.has(cp)) {
      continue // drop
    }
    if (removeBidiControl && BIDI_CONTROL_CHARS.has(cp)) {
      continue // drop
    }
    if (removeSpecialSpace && SPECIAL_SPACE_CHARS.has(cp)) {
      result.push(' ') // normalize to regular space
      continue
    }
    if (removeTagsBlock && isTagsBlock(cp)) {
      continue // drop
    }
    if (removeVariationSelectors && isVariationSelector(cp)) {
      continue // drop
    }
    if (normalizeTypoPunct) {
      const typoPunct = TYPO_PUNCT_MAP.get(cp)
      if (typoPunct) {
        result.push(typoPunct.ascii)
        continue
      }
    }
    if (removeHomoglyphs) {
      const homoglyph = HOMOGLYPH_MAP.get(cp)
      if (homoglyph) {
        result.push(homoglyph.latin) // replace with Latin equivalent
        continue
      }
    }

    result.push(ch)
  }

  return result.join('')
}

export function cleanAll(text: string): string {
  return clean(text, {
    removeZeroWidth: true,
    removeBidiControl: true,
    removeSpecialSpace: true,       // normalize to regular space
    removeTagsBlock: true,
    removeHomoglyphs: true,
    removeVariationSelectors: true,
    normalizeTypoPunct: true,
    normalizeQuotes: true,
  })
}

export function cleanByCategory(text: string, categories: Category[]): string {
  return clean(text, {
    removeZeroWidth: categories.includes(Category.ZERO_WIDTH),
    removeBidiControl: categories.includes(Category.CONTROL_BIDI),
    removeSpecialSpace: categories.includes(Category.SPECIAL_SPACE),
    removeTagsBlock: categories.includes(Category.TAGS_BLOCK),
    removeHomoglyphs: categories.includes(Category.HOMOGLYPH),
    removeVariationSelectors: categories.includes(Category.VARIATION_SELECTOR),
    normalizeTypoPunct: categories.includes(Category.TYPO_PUNCT),
    normalizeQuotes: categories.includes(Category.TYPO_PUNCT),
  })
}

/**
 * Replaces ASCII straight quotes (" and ') with typographic curly equivalents.
 * - In CJK context: uses \u201C/\u201D and \u2018/\u2019 (same Unicode curly quotes)
 * - Opening vs closing determined by preceding character:
 *   opening = preceded by whitespace, CJK open punctuation, or start of text
 *   closing = otherwise
 */
function normalizeASCIIQuotes(text: string): string {
  const chars = Array.from(text)
  const result: string[] = []

  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0)!

    if (cp !== STRAIGHT_DOUBLE_QUOTE && cp !== STRAIGHT_SINGLE_QUOTE) {
      result.push(chars[i])
      continue
    }

    const prevCp = i > 0 ? chars[i - 1].codePointAt(0)! : 0
    const isOpening = isOpeningContext(prevCp)

    if (cp === STRAIGHT_DOUBLE_QUOTE) {
      result.push(isOpening ? '\u201C' : '\u201D') // \u201C = \u201D = 
    } else {
      // Single quote / apostrophe: only treat as quote (not apostrophe)
      // when preceded/followed by CJK or space/start
      const nextCp = i < chars.length - 1 ? chars[i + 1].codePointAt(0)! : 0
      const inCjkCtx = isCJK(prevCp) || isCJK(nextCp)
      if (inCjkCtx || isOpeningContext(prevCp)) {
        result.push(isOpening ? '\u2018' : '\u2019') // \u2018 = \u2019 = 
      } else {
        result.push(chars[i]) // keep as-is (likely apostrophe in English contractions)
      }
    }
  }

  return result.join('')
}

/** Opening context: start of text, whitespace, open bracket, or CJK open punctuation */
function isOpeningContext(prevCp: number): boolean {
  if (prevCp === 0) return true  // start of text
  // whitespace
  if (prevCp === 0x0020 || prevCp === 0x00a0 || (prevCp >= 0x2000 && prevCp <= 0x200a)) return true
  // ASCII open brackets/punctuation
  if (prevCp === 0x0028 || prevCp === 0x005b || prevCp === 0x007b) return true
  // CJK open punctuation: \u300c \u300e \u3010 \uff08 \u201c \u2018
  const cjkOpen = [0x300c, 0x300e, 0x3010, 0xff08, 0x201c, 0x2018]
  if (cjkOpen.includes(prevCp)) return true
  // newline/line separator
  if (prevCp === 0x000a || prevCp === 0x000d || prevCp === 0x2028) return true
  return false
}
