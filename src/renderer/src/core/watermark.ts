/**
 * Unicode Watermark Engine v2.0
 *
 * Security upgrades over v1:
 *   ✓ AES-256-GCM (AEAD)  — authenticated encryption, rejects any tampering
 *   ✓ HKDF-SHA-256         — derives AES key, IV, stego seed, preamble from password
 *   ✓ No fixed magic byte  — 16-byte preamble is key-unique (statistically random)
 *   ✓ Nibble encoding      — 4 bits per carrier char (2× denser than v1 bit encoding)
 *   ✓ 16-carrier alphabet  — zero-width, variation selectors, special spaces, invisible math
 *   ✓ PRNG-driven offset   — carrier = (nibble + rng_offset) % 16 (not fixed i%3)
 *   ✓ CJK-safe scatter     — Fisher-Yates across every Unicode code point (no spaces needed)
 *
 * Frame layout (binary, before nibble encoding):
 *   [PREAMBLE 16B][MASKED_LEN 4B][HAS_KEY 1B][AES-GCM ciphertext + 16B auth tag]
 *
 * All public functions are async — they use the Web Crypto API (crypto.subtle),
 * available in both Electron renderer and modern browsers.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const HKDF_SALT = new TextEncoder().encode('UnicodeWatermark-v2-Salt-20260421')
const HKDF_INFO = new TextEncoder().encode('watermark-v2-key-material')

/**
 * 16-carrier alphabet (nibble = 4 bits → index 0–15).
 * Mixes zero-width chars, variation selectors, and special spaces so no
 * single character class dominates (harder to filter).
 */
const CARRIERS: readonly string[] = [
  '\u200b', // 0  Zero Width Space
  '\u200c', // 1  Zero Width Non-Joiner
  '\u200d', // 2  Zero Width Joiner
  '\u2060', // 3  Word Joiner
  '\u2061', // 4  Function Application (invisible)
  '\u2062', // 5  Invisible Times
  '\u2063', // 6  Invisible Separator
  '\u2064', // 7  Invisible Plus
  '\ufe00', // 8  Variation Selector-1
  '\ufe01', // 9  Variation Selector-2
  '\ufe02', // 10 Variation Selector-3
  '\ufe03', // 11 Variation Selector-4
  '\u200a', // 12 Hair Space
  '\u205f', // 13 Medium Mathematical Space
  '\u2007', // 14 Figure Space
  '\u2009', // 15 Thin Space
] as const

const CARRIER_SET = new Set(CARRIERS)
const CARRIER_INDEX = new Map<string, number>(CARRIERS.map((c, i) => [c, i]))

// ─────────────────────────────────────────────────────────────────────────────
// CARRIER CLASS GROUPS  (user-selectable carrier subsets)
// ─────────────────────────────────────────────────────────────────────────────

export type CarrierClass = 'zeroWidth' | 'mathInvisible' | 'variationSelector' | 'specialSpace'

export const CARRIER_GROUPS: Record<CarrierClass, readonly string[]> = {
  zeroWidth:         ['\u200b', '\u200c', '\u200d', '\u2060'],
  mathInvisible:     ['\u2061', '\u2062', '\u2063', '\u2064'],
  variationSelector: ['\ufe00', '\ufe01', '\ufe02', '\ufe03'],
  specialSpace:      ['\u200a', '\u205f', '\u2007', '\u2009'],
}

const ALL_CARRIER_CLASSES: readonly CarrierClass[] = [
  'zeroWidth', 'mathInvisible', 'variationSelector', 'specialSpace',
] as const

interface DynamicCarrierTable {
  table: string[]
  index: Map<string, number>
  bitsPerSymbol: number
}

function buildDynamicTable(classes: CarrierClass[]): DynamicCarrierTable {
  const sorted = ALL_CARRIER_CLASSES.filter((c) => classes.includes(c))
  if (sorted.length === 0) throw new Error('At least one carrier class must be selected')
  const allChars: string[] = []
  for (const cls of sorted) allChars.push(...CARRIER_GROUPS[cls])
  const bitsPerSymbol = Math.floor(Math.log2(allChars.length))
  const effectiveSize = 1 << bitsPerSymbol
  const table = allChars.slice(0, effectiveSize)
  const index = new Map(table.map((c, i) => [c, i]))
  return { table, index, bitsPerSymbol }
}

const DEFAULT_CARRIER_TABLE: DynamicCarrierTable = {
  table: [...CARRIERS],
  index: new Map(CARRIERS.map((c, i) => [c, i])),
  bitsPerSymbol: 4,
}

/** Binary frame overhead: 16B preamble + 4B masked-length + 1B has_key */
const FRAME_HEADER = 21

/** Robust v3 record marker bytes */
const ROBUST_MAGIC_0 = 0xa5
const ROBUST_MAGIC_1 = 0x5a
const ROBUST_VERSION = 1

// ─────────────────────────────────────────────────────────────────────────────
// PRNG  (mulberry32)
// ─────────────────────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), 61 | t))) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEY MATERIAL  (HKDF-SHA-256, 68 bytes derived)
// ─────────────────────────────────────────────────────────────────────────────

interface KeyMaterial {
  aesKey: CryptoKey
  nonce: Uint8Array<ArrayBuffer>
  stegoSeed: number
  scatterSeed: number
  preamble: Uint8Array<ArrayBuffer>
  hasKey: boolean
}

async function deriveKeyMaterial(password: string): Promise<KeyMaterial> {
  const pwBytes = new TextEncoder().encode(password)
  const hasKey = pwBytes.length > 0

  const baseKey = await crypto.subtle.importKey('raw', pwBytes, 'HKDF', false, ['deriveBits'])
  const raw = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
      baseKey,
      68 * 8,
    ),
  )

  const aesKey = await crypto.subtle.importKey(
    'raw',
    raw.slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )

  const view = new DataView(raw.buffer, raw.byteOffset)
  return {
    aesKey,
    nonce: new Uint8Array(raw.slice(32, 44)),          // fresh ArrayBuffer (not SharedArrayBuffer)
    stegoSeed: view.getUint32(44, false),
    scatterSeed: view.getUint32(48, false),
    preamble: new Uint8Array(raw.slice(52, 68)),        // fresh ArrayBuffer
    hasKey,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM  AEAD
// ─────────────────────────────────────────────────────────────────────────────

/** Returns ciphertext ‖ 16-byte auth tag. additionalData = preamble. */
async function aesEncrypt(km: KeyMaterial, plaintext: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: km.nonce, additionalData: km.preamble },
      km.aesKey,
      plaintext.buffer.slice(plaintext.byteOffset, plaintext.byteOffset + plaintext.byteLength) as ArrayBuffer,
    ),
  )
}

/**
 * Verifies auth tag then decrypts.
 * Throws DOMException (name='OperationError') on wrong key or any tampering.
 */
async function aesDecrypt(km: KeyMaterial, ciphertext: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: km.nonce, additionalData: km.preamble },
      km.aesKey,
      ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer,
    ),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NIBBLE ↔ CARRIER  (4 bits per char, PRNG-driven dynamic mapping)
// ─────────────────────────────────────────────────────────────────────────────

function bytesToNibbles(bytes: Uint8Array): number[] {
  const out: number[] = []
  for (const b of bytes) {
    out.push((b >> 4) & 0xf)
    out.push(b & 0xf)
  }
  return out
}

function nibblesToBytes(nibs: number[]): Uint8Array {
  const out = new Uint8Array(Math.floor(nibs.length / 2))
  for (let i = 0; i < out.length; i++) {
    out[i] = ((nibs[i * 2] & 0xf) << 4) | (nibs[i * 2 + 1] & 0xf)
  }
  return out
}

/**
 * Encode nibbles → invisible carrier string.
 * Each nibble n encodes as CARRIERS[(n + floor(rng()×16)) % 16].
 * Without the seed the carrier stream is statistically indistinguishable from noise.
 */
function encodeNibbles(nibs: number[], stegoSeed: number): string {
  const rng = seededRandom(stegoSeed)
  return nibs.map((n) => CARRIERS[(n + Math.floor(rng() * 16)) % 16]).join('')
}

/** Reverse of encodeNibbles — must use the identical seed. */
function decodeCarriers(carriers: string[], stegoSeed: number): number[] {
  const rng = seededRandom(stegoSeed)
  return carriers.map((ch) => {
    const offset = Math.floor(rng() * 16)
    return ((CARRIER_INDEX.get(ch) ?? 0) - offset + 16) % 16
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// BIT-LEVEL CARRIER ENCODING  (variable bits-per-symbol for dynamic tables)
// ─────────────────────────────────────────────────────────────────────────────

function encodeBytesToCarriers(bytes: Uint8Array, ct: DynamicCarrierTable): string {
  const { table, bitsPerSymbol: bps } = ct
  const bits: number[] = []
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1)
  }
  while (bits.length % bps !== 0) bits.push(0)
  let result = ''
  for (let i = 0; i < bits.length; i += bps) {
    let val = 0
    for (let j = 0; j < bps; j++) val = (val << 1) | bits[i + j]
    result += table[val]
  }
  return result
}

function decodeCarriersToBytes(carriers: string[], ct: DynamicCarrierTable): Uint8Array {
  const { index, bitsPerSymbol: bps } = ct
  const bits: number[] = []
  for (const ch of carriers) {
    const val = index.get(ch)
    if (val === undefined) continue
    for (let i = bps - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }
  const n = Math.floor(bits.length / 8)
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j]
    out[i] = v
  }
  return out
}

function detectCarrierTable(carrierChars: string[]): DynamicCarrierTable {
  const detected = new Set<CarrierClass>()
  for (const ch of carrierChars) {
    const fullIdx = CARRIER_INDEX.get(ch)
    if (fullIdx !== undefined) {
      detected.add(ALL_CARRIER_CLASSES[Math.floor(fullIdx / 4)])
    }
  }
  if (detected.size === 0 || detected.size === 4) return DEFAULT_CARRIER_TABLE
  return buildDynamicTable([...detected])
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME  build / parse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Frame: [PREAMBLE 16B][MASKED_LEN 4B][HAS_KEY 1B][AES-GCM output]
 * MASKED_LEN = actual_len XOR lower 32 bits of stegoSeed.
 */
function buildFrame(km: KeyMaterial, encData: Uint8Array): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER + encData.length)
  frame.set(km.preamble, 0)
  const maskedLen = (encData.length ^ km.stegoSeed) >>> 0
  new DataView(frame.buffer).setUint32(16, maskedLen, false)
  frame[20] = km.hasKey ? 1 : 0
  frame.set(encData, FRAME_HEADER)
  return frame
}

function parseFrame(
  km: KeyMaterial,
  frameBytes: Uint8Array,
): { encData: Uint8Array; hasKey: boolean } {
  if (frameBytes.length < FRAME_HEADER) {
    throw new Error('Frame too short to parse')
  }
  for (let i = 0; i < 16; i++) {
    if (frameBytes[i] !== km.preamble[i]) throw new Error('PREAMBLE_MISMATCH')
  }
  const maskedLen = new DataView(frameBytes.buffer, frameBytes.byteOffset).getUint32(16, false)
  const encLen = (maskedLen ^ km.stegoSeed) >>> 0
  const hasKey = frameBytes[20] === 1
  if (FRAME_HEADER + encLen > frameBytes.length) {
    throw new Error(
      `Payload length (${encLen} B) exceeds available data — text may be truncated`,
    )
  }
  return { encData: frameBytes.slice(FRAME_HEADER, FRAME_HEADER + encLen), hasKey }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCATTER  (Fisher-Yates, 1 carrier char per gap, CJK-safe)
// ─────────────────────────────────────────────────────────────────────────────

function scatterInvisible(invisible: string, hostText: string, scatterSeed: number): string {
  const chars = Array.from(hostText)
  const nPos = chars.length + 1
  const ni = invisible.length

  if (chars.length === 0) return invisible

  let overflow = ''
  let inv = invisible
  if (nPos < ni) {
    overflow = inv.slice(0, ni - nPos)
    inv = inv.slice(ni - nPos)
  }

  const rng = seededRandom(scatterSeed)
  const positions = Array.from({ length: nPos }, (_, i) => i)
  for (let i = nPos - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }
  const chosen = positions.slice(0, inv.length).sort((a, b) => a - b)

  const insMap = new Map<number, string>()
  for (let k = 0; k < chosen.length; k++) {
    insMap.set(chosen[k], (insMap.get(chosen[k]) ?? '') + inv[k])
  }

  let result = overflow + (insMap.get(0) ?? '')
  for (let i = 0; i < chars.length; i++) {
    result += chars[i] + (insMap.get(i + 1) ?? '')
  }
  return result
}


function crc8(bytes: Uint8Array): number {
  let c = 0
  for (const b of bytes) c ^= b
  return c & 0xff
}

function chunkBytes(data: Uint8Array, chunkSize: number): Uint8Array[] {
  const out: Uint8Array[] = []
  for (let i = 0; i < data.length; i += chunkSize) {
    out.push(data.slice(i, i + chunkSize))
  }
  return out
}

function shuffledIndices(length: number, seed: number): number[] {
  const rng = seededRandom(seed)
  const idx = Array.from({ length }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

interface RobustTune {
  blockSize: number
  redundancy: number
}

function resolveRobustTune(options?: Pick<EmbedOptions, 'profile' | 'redundancy'>): RobustTune {
  const profile = options?.profile ?? 'balanced'
  const defaultTune: RobustTune =
    profile === 'strong'
      ? { blockSize: 24, redundancy: 4 }
      : { blockSize: 32, redundancy: 3 }
  const redundancy = Math.max(2, Math.min(6, options?.redundancy ?? defaultTune.redundancy))
  return { ...defaultTune, redundancy }
}

function buildRobustCarrierStream(
  frame: Uint8Array,
  km: KeyMaterial,
  tune: RobustTune,
  ct: DynamicCarrierTable = DEFAULT_CARRIER_TABLE,
): string {
  const shards = chunkBytes(frame, tune.blockSize)
  const total = shards.length
  const records: Uint8Array[] = []

  for (let idx = 0; idx < total; idx++) {
    const shard = shards[idx]
    for (let copy = 0; copy < tune.redundancy; copy++) {
      const rec = new Uint8Array(2 + 1 + 2 + 2 + 1 + 1 + shard.length + 1)
      rec[0] = ROBUST_MAGIC_0
      rec[1] = ROBUST_MAGIC_1
      rec[2] = ROBUST_VERSION
      rec[3] = (total >> 8) & 0xff
      rec[4] = total & 0xff
      rec[5] = (idx >> 8) & 0xff
      rec[6] = idx & 0xff
      rec[7] = copy & 0xff
      rec[8] = shard.length & 0xff
      rec.set(shard, 9)
      rec[rec.length - 1] = crc8(rec.slice(2, rec.length - 1))
      records.push(rec)
    }
  }

  const order = shuffledIndices(records.length, km.scatterSeed ^ 0x9e3779b9)
  const merged: number[] = []
  for (const o of order) merged.push(...records[o])
  const bytes = new Uint8Array(merged)
  return encodeBytesToCarriers(bytes, ct)
}

interface RobustDecodeData {
  frame: Uint8Array
  recoveredShards: number
  totalShards: number
  shardAgreement: number
}

function parseRobustCarrierStream(
  carrierChars: string[],
  ct: DynamicCarrierTable = DEFAULT_CARRIER_TABLE,
): RobustDecodeData {
  const bytes = decodeCarriersToBytes(carrierChars, ct)

  // idx -> payloadHex -> votes
  const votesByShard = new Map<number, Map<string, number>>()
  const totalsByShard = new Map<number, number>()
  const totalsObserved = new Map<number, number>()

  let i = 0
  while (i + 10 < bytes.length) {
    if (bytes[i] !== ROBUST_MAGIC_0 || bytes[i + 1] !== ROBUST_MAGIC_1) {
      i++
      continue
    }

    const version = bytes[i + 2]
    const total = (bytes[i + 3] << 8) | bytes[i + 4]
    const idx = (bytes[i + 5] << 8) | bytes[i + 6]
    const dataLen = bytes[i + 8]
    const end = i + 10 + dataLen

    if (version !== ROBUST_VERSION || total <= 0 || idx >= total || end > bytes.length) {
      i++
      continue
    }

    const data = bytes.slice(i + 9, i + 9 + dataLen)
    const expectedCrc = bytes[end - 1]
    const actualCrc = crc8(bytes.slice(i + 2, end - 1))
    if (expectedCrc !== actualCrc) {
      i++
      continue
    }

    totalsObserved.set(total, (totalsObserved.get(total) ?? 0) + 1)

    const key = Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('')
    if (!votesByShard.has(idx)) votesByShard.set(idx, new Map())
    const m = votesByShard.get(idx)!
    m.set(key, (m.get(key) ?? 0) + 1)
    totalsByShard.set(idx, (totalsByShard.get(idx) ?? 0) + 1)

    // Jump to end of parsed record to speed up and reduce duplicate false parses
    i = end
  }

  if (totalsObserved.size === 0) {
    throw new Error('No robust watermark records found')
  }

  let totalShards = 0
  let bestVotes = -1
  for (const [t, v] of totalsObserved) {
    if (v > bestVotes) {
      bestVotes = v
      totalShards = t
    }
  }

  const chosenShards: Uint8Array[] = []
  let recovered = 0
  let agreementAccum = 0
  for (let idx = 0; idx < totalShards; idx++) {
    const m = votesByShard.get(idx)
    if (!m || m.size === 0) break
    let bestKey = ''
    let best = -1
    let sum = 0
    for (const [k, v] of m) {
      sum += v
      if (v > best) {
        best = v
        bestKey = k
      }
    }
    const bytesArr = bestKey.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? []
    chosenShards.push(new Uint8Array(bytesArr))
    recovered++
    agreementAccum += sum > 0 ? best / sum : 0
  }

  if (recovered === 0) {
    throw new Error('Robust shards were detected but none could be reconstructed')
  }

  if (recovered < totalShards) {
    throw new Error(`Recovered ${recovered}/${totalShards} shards — watermark too damaged`)
  }

  const frameLength = chosenShards.reduce((s, c) => s + c.length, 0)
  const frame = new Uint8Array(frameLength)
  let off = 0
  for (const s of chosenShards) {
    frame.set(s, off)
    off += s.length
  }

  return {
    frame,
    recoveredShards: recovered,
    totalShards,
    shardAgreement: agreementAccum / Math.max(recovered, 1),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbedOptions {
  message: string
  hostText: string
  key?: string
  robust?: boolean
  redundancy?: number
  profile?: 'balanced' | 'strong'
  carrierClasses?: CarrierClass[]
}

export interface EmbedResult {
  watermarked: string
  /** nibbleCount × 4 — kept for UI compatibility */
  bitCount: number
  /** Number of invisible carrier chars embedded */
  charCount: number
}

export interface DecodeResult {
  success: boolean
  message?: string
  error?: string
  hasKey?: boolean
  confidence?: number
  diagnostics?: {
    strategyUsed: 'v3-robust' | 'v2-legacy'
    recoveredShards?: number
    totalShards?: number
    shardAgreement?: number
    extractedCarrierChars: number
  }
}

/**
 * Embed a watermark into host text.
 *
 * Pipeline:
 *   message → UTF-8 → AES-256-GCM (HKDF key) → frame → nibble encode → scatter
 */
export async function embedWatermark({
  message,
  hostText,
  key,
  robust = true,
  redundancy,
  profile = 'balanced',
  carrierClasses,
}: EmbedOptions): Promise<EmbedResult> {
  const ct =
    carrierClasses && carrierClasses.length > 0 && carrierClasses.length < 4
      ? buildDynamicTable(carrierClasses)
      : DEFAULT_CARRIER_TABLE

  const km = await deriveKeyMaterial(key ?? '')
  const msgBytes = new TextEncoder().encode(message)
  const encData = await aesEncrypt(km, msgBytes)
  const frame = buildFrame(km, encData)
  const tune = resolveRobustTune({ redundancy, profile })
  const invisible = robust
    ? buildRobustCarrierStream(frame, km, tune, ct)
    : encodeNibbles(bytesToNibbles(frame), km.stegoSeed)
  const watermarked = scatterInvisible(invisible, hostText, km.scatterSeed)
  return { watermarked, bitCount: invisible.length * ct.bitsPerSymbol, charCount: invisible.length }
}

/**
 * Extract and verify a watermark from text.
 *
 * Pipeline:
 *   collect carriers → decode nibbles → parse frame → AES-GCM decrypt+verify → UTF-8
 */
export async function decodeWatermark(text: string, key?: string): Promise<DecodeResult> {
  const carrierChars = Array.from(text).filter((ch) => CARRIER_SET.has(ch))

  if (carrierChars.length === 0) {
    return { success: false, error: 'No watermark carrier characters found in text' }
  }
  if (carrierChars.length < FRAME_HEADER * 2) {
    return { success: false, error: 'Insufficient watermark data — text may be truncated' }
  }

  let km: KeyMaterial
  try {
    km = await deriveKeyMaterial(key ?? '')
  } catch {
    return { success: false, error: 'Key derivation failed' }
  }

  // Detect which carrier classes are present, then try detected table + full table
  const detectedCt = detectCarrierTable(carrierChars)
  const tablesToTry: DynamicCarrierTable[] =
    detectedCt.bitsPerSymbol === DEFAULT_CARRIER_TABLE.bitsPerSymbol
      ? [DEFAULT_CARRIER_TABLE]
      : [detectedCt, DEFAULT_CARRIER_TABLE]

  // v3 robust-first decode path — try each candidate table
  for (const ct of tablesToTry) {
    try {
      const robustData = parseRobustCarrierStream(carrierChars, ct)
      const { encData, hasKey } = parseFrame(km, robustData.frame)
      if (hasKey && !key) {
        return { success: false, hasKey: true, error: 'This watermark requires a password to decode' }
      }
      const msgBytes = await aesDecrypt(km, encData)
      const message = new TextDecoder().decode(msgBytes)
      const recoveredRatio = robustData.recoveredShards / Math.max(robustData.totalShards, 1)
      const confidence = Math.round((0.7 * recoveredRatio + 0.3 * robustData.shardAgreement) * 100)
      return {
        success: true,
        message,
        hasKey,
        confidence,
        diagnostics: {
          strategyUsed: 'v3-robust',
          recoveredShards: robustData.recoveredShards,
          totalShards: robustData.totalShards,
          shardAgreement: Number(robustData.shardAgreement.toFixed(3)),
          extractedCarrierChars: carrierChars.length,
        },
      }
    } catch {
      continue
    }
  }

  // v2 legacy decode (always uses full 16-carrier nibble encoding)
  const nibs = decodeCarriers(carrierChars, km.stegoSeed)
  const frameBytes = nibblesToBytes(nibs)

  let encData: Uint8Array
  let hasKey: boolean
  try {
    ;({ encData, hasKey } = parseFrame(km, frameBytes))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'PREAMBLE_MISMATCH') {
      return {
        success: false,
        hasKey: true,
        error: key
          ? 'Wrong password — preamble does not match'
          : 'Preamble mismatch — this watermark may require a password to decode',
      }
    }
    return { success: false, error: msg }
  }

  if (hasKey && !key) {
    return { success: false, hasKey: true, error: 'This watermark requires a password to decode' }
  }

  try {
    const msgBytes = await aesDecrypt(km, encData)
    const message = new TextDecoder().decode(msgBytes)
    return {
      success: true,
      message,
      hasKey,
      confidence: 100,
      diagnostics: {
        strategyUsed: 'v2-legacy',
        extractedCarrierChars: carrierChars.length,
      },
    }
  } catch {
    return {
      success: false,
      error: key
        ? 'Wrong password — authentication failed (AES-GCM tag mismatch)'
        : 'Watermark authentication failed — data may be corrupted',
    }
  }
}

