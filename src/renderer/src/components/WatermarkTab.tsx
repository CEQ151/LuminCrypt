import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fingerprint,
  Key,
  Copy,
  Check,
  LockKey,
  LockOpen,
  Bug,
  Shuffle,
  Info,
  ImageSquare,
  ScanSmiley,
} from '@phosphor-icons/react'
import { useWatermark } from '../hooks/useWatermark'
import { CarrierClass } from '../core/watermark'
import { PoisonOptions, PoisonDensity } from '../core/poisoner'
import { ImageWatermarkPanel } from './ImageWatermarkPanel'

// ── Reusable copy button ──────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [text])
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-zinc-200 transition-colors cursor-pointer no-drag px-2 py-1 rounded hover:bg-white/[0.06]"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── Textarea with label ───────────────────────────────────────────────────────
function TextArea({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  rows = 7,
  mono = false,
  extra,
  grow = false,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  rows?: number
  mono?: boolean
  extra?: React.ReactNode
  grow?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${grow ? 'flex-1 min-h-0' : ''}`}>
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{label}</span>
        {extra}
      </div>
      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={grow ? undefined : rows}
        spellCheck={false}
        className={`
          w-full bg-black/30 rounded-xl
          border border-white/[0.06] focus:border-cyan-400/20
          text-sm text-white leading-relaxed resize-none
          px-4 py-3.5 focus:outline-none
          placeholder:text-zinc-700 transition-all duration-300
          ${mono ? 'font-mono' : 'font-body'}
          ${readOnly ? 'opacity-80 cursor-default' : ''}
          ${grow ? 'flex-1 min-h-0 h-full' : ''}
        `}
      />
    </div>
  )
}

// ── Key input ─────────────────────────────────────────────────────────────────
function KeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
        密钥（可选）
      </span>
      <div className="relative">
        <Key size={13} weight="regular" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '留空则无密钥保护'}
          spellCheck={false}
          className="
            w-full bg-black/25 rounded-lg
            border border-white/[0.07] focus:border-white/[0.18]
            text-sm text-white pl-8 pr-10 py-2.5
            focus:outline-none placeholder:text-zinc-700
            transition-colors duration-200
          "
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors cursor-pointer"
        >
          {show ? <LockOpen size={13} weight="regular" /> : <LockKey size={13} weight="regular" />}
        </button>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-xs leading-relaxed
        ${ok ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' : 'bg-red-500/10 border border-red-500/25 text-red-300'}`}
    >
      <Info size={13} weight="regular" className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
  loadingLabel,
  color = 'blue',
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  icon: React.ReactNode
  label: string
  loadingLabel?: string
  color?: 'blue' | 'violet' | 'amber'
}) {
  const colors = {
    blue: 'bg-[#3b7cd4] hover:bg-[#4a8ae0]',
    violet: 'bg-violet-600 hover:bg-violet-500',
    amber: 'bg-amber-600 hover:bg-amber-500',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        flex items-center gap-2 px-5 py-2.5 rounded-lg
        text-sm font-medium text-white
        ${colors[color]}
        border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]
        transition-all duration-200 cursor-pointer no-drag
        disabled:opacity-40 disabled:cursor-not-allowed select-none
      `}
    >
      {icon}
      {loading ? (loadingLabel ?? '处理中…') : label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBED SUB-PANEL
// ─────────────────────────────────────────────────────────────────────────────
const CARRIER_CLASS_OPTIONS: Array<{ id: CarrierClass; label: string; desc: string }> = [
  { id: 'zeroWidth', label: '零宽字符', desc: 'U+200B/C/D/2060' },
  { id: 'mathInvisible', label: '不可见运算符', desc: 'U+2061–2064' },
  { id: 'variationSelector', label: '变体选择符', desc: 'U+FE00–FE03' },
  { id: 'specialSpace', label: '特殊空格', desc: 'U+200A/2009 等' },
]

function EmbedPanel() {
  const [hostText, setHostText] = useState('')
  const [message, setMessage] = useState('')
  const [key, setKey] = useState('')
  const [profile, setProfile] = useState<'balanced' | 'strong'>('balanced')
  const [carrierMask, setCarrierMask] = useState<Record<CarrierClass, boolean>>({
    zeroWidth: true,
    mathInvisible: true,
    variationSelector: true,
    specialSpace: true,
  })
  const { embedStatus, embedResult, embedError, runEmbed } = useWatermark()

  const enabledClasses = CARRIER_CLASS_OPTIONS.map((o) => o.id).filter((id) => carrierMask[id])
  const enabledCount = enabledClasses.length

  const toggleCarrier = (id: CarrierClass) => {
    setCarrierMask((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      if (Object.values(next).filter(Boolean).length === 0) return prev
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <TextArea
          label="宿主文本"
          value={hostText}
          onChange={setHostText}
          placeholder="粘贴要嵌入水印的原文…"
          rows={10}
        />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <TextArea
              label="水印消息（明文）"
              value={message}
              onChange={setMessage}
              placeholder="输入要隐藏的信息，支持中英文…"
              rows={4}
            />
            {message && (
              <p className="text-[10px] text-zinc-600 px-1">
                {Array.from(message).length} 字符 ={' '}
                {new TextEncoder().encode(message).length} 字节
                {new TextEncoder().encode(message).length > 300 && (
                  <span className="text-amber-500/80"> · 消息较长，请确保宿主文本足够长</span>
                )}
              </p>
            )}
          </div>
          <KeyInput value={key} onChange={setKey} />

          {/* Carrier class selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">载体字符类型</span>
            <div className="grid grid-cols-2 gap-1">
              {CARRIER_CLASS_OPTIONS.map(({ id, label, desc }) => (
                <label
                  key={id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <div
                    onClick={(e) => { e.preventDefault(); toggleCarrier(id) }}
                    className={`w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center cursor-pointer transition-all ${
                      carrierMask[id]
                        ? 'bg-[#3b7cd4] border-[#3b7cd4]'
                        : 'bg-transparent border-white/[0.15]'
                    }`}
                  >
                    {carrierMask[id] && <Check size={9} weight="bold" className="text-white" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-white">{label}</span>
                    <span className="text-[9px] text-zinc-600 ml-1">{desc}</span>
                  </div>
                </label>
              ))}
            </div>
            {enabledCount < 4 && (
              <p className="text-[9px] text-amber-500/70 px-1">
                {enabledCount <= 1
                  ? '仅 4 个载体字符，水印长度约增加 2 倍'
                  : enabledCount === 2
                    ? '8 个载体字符，水印长度约增加 33%'
                    : '实际使用前 2 类（8 字符），第 3 类不参与编码'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
              <button
                onClick={() => setProfile('balanced')}
                className={`px-2 py-1 text-[10px] rounded-md transition-colors cursor-pointer ${
                  profile === 'balanced' ? 'bg-white/[0.12] text-zinc-200' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                鲁棒-均衡
              </button>
              <button
                onClick={() => setProfile('strong')}
                className={`px-2 py-1 text-[10px] rounded-md transition-colors cursor-pointer ${
                  profile === 'strong' ? 'bg-white/[0.12] text-zinc-200' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                鲁棒-增强
              </button>
            </div>
            <ActionButton
              onClick={() => runEmbed(message, hostText, key, {
                robust: true,
                profile,
                carrierClasses: enabledCount < 4 ? enabledClasses : undefined,
              })}
              disabled={!message.trim() || !hostText.trim()}
              loading={embedStatus === 'working'}
              icon={<Fingerprint size={15} weight="regular" />}
              label="嵌入水印"
              color="blue"
            />
            {embedResult && (
              <span className="text-xs text-zinc-600">
                已嵌入 {embedResult.charCount} 个不可见字符
              </span>
            )}
          </div>
          {embedError && <StatusBadge ok={false} message={embedError} />}
        </div>
      </div>

      <AnimatePresence>
        {embedResult && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-1.5"
          >
            <TextArea
              label="含水印文本（可直接复制使用）"
              value={embedResult.watermarked}
              readOnly
              rows={6}
              mono
              extra={<CopyButton text={embedResult.watermarked} />}
            />
            <p className="text-[10px] text-zinc-600 px-1">
              共 {embedResult.bitCount} bits → {embedResult.charCount} 个不可见字符，已随机散布于宿主文本 {Array.from(hostText).length} 个字符中
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DECODE SUB-PANEL
// ─────────────────────────────────────────────────────────────────────────────
function DecodePanel() {
  const [inputText, setInputText] = useState('')
  const [key, setKey] = useState('')
  const { decodeStatus, decodeResult, runDecode } = useWatermark()

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <TextArea
          label="待检测文本（粘贴含水印的文本）"
          value={inputText}
          onChange={setInputText}
          placeholder="粘贴含水印的文本，软件将自动提取并解密水印…"
          rows={10}
        />
        <div className="flex flex-col gap-4">
          <KeyInput value={key} onChange={setKey} placeholder="若水印有密钥保护，在此输入" />
          <ActionButton
            onClick={() => runDecode(inputText, key)}
            disabled={!inputText.trim()}
            loading={decodeStatus === 'working'}
            icon={<LockOpen size={15} weight="regular" />}
            label="解密水印"
            color="violet"
          />

          <AnimatePresence>
            {decodeResult && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                {decodeResult.success ? (
                  <>
                    <StatusBadge ok={true} message="成功解密水印" />
                    <div className="bg-black/25 rounded-xl border border-emerald-500/20 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                          水印明文
                        </span>
                        <CopyButton text={decodeResult.message ?? ''} />
                      </div>
                      <p className="text-sm text-emerald-300 font-['Geist',sans-serif] leading-relaxed break-all">
                        {decodeResult.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                      {decodeResult.hasKey ? (
                        <><LockKey size={11} weight="regular" /> 加密水印（密钥解密）</>
                      ) : (
                        <><LockOpen size={11} weight="regular" /> 明文水印（无密钥）</>
                      )}
                    </div>
                    {typeof decodeResult.confidence === 'number' && (
                      <div className="text-xs text-zinc-500">
                        置信度: {decodeResult.confidence}%
                        {decodeResult.diagnostics?.strategyUsed && ` · ${decodeResult.diagnostics.strategyUsed}`}
                      </div>
                    )}
                    {decodeResult.diagnostics?.recoveredShards !== undefined &&
                      decodeResult.diagnostics?.totalShards !== undefined && (
                        <div className="text-[11px] text-zinc-600">
                          恢复分片: {decodeResult.diagnostics.recoveredShards}/
                          {decodeResult.diagnostics.totalShards}
                          {decodeResult.diagnostics.shardAgreement !== undefined &&
                            ` · 一致性 ${Math.round(decodeResult.diagnostics.shardAgreement * 100)}%`}
                        </div>
                    )}
                  </>
                ) : (
                  <StatusBadge
                    ok={false}
                    message={
                      decodeResult.hasKey && !key
                        ? '此水印需要密钥才能解密，请在上方输入密钥后重试'
                        : (decodeResult.error ?? '解密失败')
                    }
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// POISON SUB-PANEL
// ─────────────────────────────────────────────────────────────────────────────
const POISON_CATEGORIES: Array<{ key: keyof Omit<PoisonOptions, 'density'>; label: string; description: string }> = [
  { key: 'zeroWidth', label: '零宽字符', description: 'U+200B/200C/2060 等，完全不可见' },
  { key: 'homoglyphs', label: '同形字符', description: '西里尔/希腊字母替换 Latin 字母' },
  { key: 'bidiControl', label: 'BiDi 控制符', description: '双向文本控制，可反转显示顺序' },
  { key: 'specialSpace', label: '特殊空格', description: 'Hair/Thin/Punctuation Space 等' },
  { key: 'tagsBlock', label: 'Tags Block', description: 'U+E0041–E005A，AI 水印常用范围' },
  { key: 'variationSelectors', label: '变体选择器', description: 'U+FE00–FE07，附着于普通字符' },
]

function PoisonPanel() {
  const [inputText, setInputText] = useState('')
  const [density, setDensity] = useState<PoisonDensity>('medium')
  const [selected, setSelected] = useState<Partial<Record<keyof Omit<PoisonOptions, 'density'>, boolean>>>({
    zeroWidth: true,
    homoglyphs: true,
    bidiControl: false,
    specialSpace: true,
    tagsBlock: false,
    variationSelectors: true,
  })
  const { poisonStatus, poisonResult, poisonError, runPoison } = useWatermark()

  const toggleCat = (key: keyof Omit<PoisonOptions, 'density'>) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }))

  const handlePoison = () => {
    const opts: PoisonOptions = { density, ...selected }
    runPoison(inputText, opts)
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <TextArea
          label="原始文本"
          value={inputText}
          onChange={setInputText}
          placeholder="粘贴要投毒的文本…"
          rows={10}
        />
        <div className="flex flex-col gap-4">
          {/* Category toggles */}
          <div>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest block mb-2">
              注入字符类型
            </span>
            <div className="flex flex-col gap-1">
              {POISON_CATEGORIES.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors group"
                >
                  <div
                    onClick={() => toggleCat(key)}
                    className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center cursor-pointer transition-all ${
                      selected[key]
                        ? 'bg-[#3b7cd4] border-[#3b7cd4]'
                        : 'bg-transparent border-white/[0.15]'
                    }`}
                  >
                    {selected[key] && <Check size={10} weight="bold" className="text-white" />}
                  </div>
                  <div>
                    <span className="text-xs text-white">{label}</span>
                    <span className="text-[10px] text-zinc-600 ml-1.5">{description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Density selector */}
          <div>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest block mb-2">
              注入密度
            </span>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as PoisonDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer no-drag border ${
                    density === d
                      ? 'bg-white/[0.08] border-white/[0.2] text-zinc-200'
                      : 'bg-transparent border-white/[0.06] text-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {d === 'low' ? '低' : d === 'medium' ? '中' : '高'}
                </button>
              ))}
            </div>
          </div>

          <ActionButton
            onClick={handlePoison}
            disabled={!inputText.trim() || !Object.values(selected).some(Boolean)}
            loading={poisonStatus === 'working'}
            icon={<Bug size={15} weight="regular" />}
            label="开始投毒"
            loadingLabel="投毒中…"
            color="amber"
          />
          {poisonError && <StatusBadge ok={false} message={poisonError} />}
        </div>
      </div>

      <AnimatePresence>
        {poisonResult && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-1.5"
          >
            <TextArea
              label={`投毒结果（注入 ${poisonResult.injectedCount} 个字符）`}
              value={poisonResult.poisoned}
              readOnly
              rows={6}
              mono
              extra={<CopyButton text={poisonResult.poisoned} />}
            />
            {Object.keys(poisonResult.byCategory).length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {Object.entries(poisonResult.byCategory).map(([cat, count]) => (
                  <span
                    key={cat}
                    className="text-[10px] bg-white/[0.04] border border-white/[0.07] rounded px-2 py-0.5 text-zinc-300"
                  >
                    {cat}: {count}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WATERMARK TAB  (三级结构)
//
//  顶层 Tab          二级 Sub-Tab
//  ─────────────     ──────────────────────
//  嵌入水印          加密字符水印 | 随机投毒
//  图片水印嵌入      (单独面板)
//  解密水印          解密字符 | 解密图片
// ─────────────────────────────────────────────────────────────────────────────

type TopTab = 'embed' | 'img-embed' | 'decode'
type EmbedSubTab = 'char-embed' | 'poison'
type DecodeSubTab = 'char-decode' | 'img-decode'

const TOP_TABS: Array<{ id: TopTab; label: string; icon: React.ReactNode }> = [
  { id: 'embed',     label: '嵌入水印',   icon: <Fingerprint size={13} weight="regular" /> },
  { id: 'img-embed', label: '图片水印嵌入', icon: <ImageSquare size={13} weight="regular" /> },
  { id: 'decode',    label: '解密水印',   icon: <LockOpen size={13} weight="regular" /> },
]

function SubTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; icon: React.ReactNode }>
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex items-center gap-1 px-5 pt-3 pb-2 border-b border-white/[0.04] flex-shrink-0">
      <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.05]">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`
              flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md
              transition-all duration-200 cursor-pointer no-drag
              ${active === id
                ? 'bg-white/[0.07] text-zinc-200 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-200'
              }
            `}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function WatermarkTab() {
  const [topTab, setTopTab] = useState<TopTab>('embed')
  const [embedSub, setEmbedSub] = useState<EmbedSubTab>('char-embed')
  const [decodeSub, setDecodeSub] = useState<DecodeSubTab>('char-decode')

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Top tab bar */}
      <div className="flex items-center gap-1 px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {TOP_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTopTab(id)}
              className={`
                flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-md
                transition-all duration-200 cursor-pointer no-drag
                ${topTab === id
                  ? 'bg-black/35 text-zinc-200 shadow-sm'
                  : 'text-zinc-300 hover:text-white'
                }
              `}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-700">
          {topTab === 'img-embed' ? (
            <>Block-DCT · QIM · Reed-Solomon</>
          ) : (
            <><Shuffle size={11} weight="regular" />AES-256-GCM · HKDF · 散射嵌入</>
          )}
        </div>
      </div>

      {/* ── 图片水印嵌入 (no sub-tabs) */}
      {topTab === 'img-embed' && (
        <ImageWatermarkPanel activeTab="img-embed" />
      )}

      {/* ── 嵌入水印 */}
      {topTab === 'embed' && (
        <>
          <SubTabBar
            tabs={[
              { id: 'char-embed' as EmbedSubTab, label: '加密字符水印', icon: <Fingerprint size={12} weight="regular" /> },
              { id: 'poison'    as EmbedSubTab, label: '随机投毒',     icon: <Bug size={12} weight="regular" /> },
            ]}
            active={embedSub}
            onChange={setEmbedSub}
          />
          <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col">
            <AnimatePresence mode="wait">
              {embedSub === 'char-embed' && (
                <motion.div key="char-embed" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                  <EmbedPanel />
                </motion.div>
              )}
              {embedSub === 'poison' && (
                <motion.div key="poison" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                  <PoisonPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ── 解密水印 */}
      {topTab === 'decode' && (
        <>
          <SubTabBar
            tabs={[
              { id: 'char-decode' as DecodeSubTab, label: '解密字符', icon: <LockOpen size={12} weight="regular" /> },
              { id: 'img-decode'  as DecodeSubTab, label: '解密图片', icon: <ScanSmiley size={12} weight="regular" /> },
            ]}
            active={decodeSub}
            onChange={setDecodeSub}
          />
          <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col">
            <AnimatePresence mode="wait">
              {decodeSub === 'char-decode' && (
                <motion.div key="char-decode" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                  <DecodePanel />
                </motion.div>
              )}
              {decodeSub === 'img-decode' && (
                <motion.div key="img-decode" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full -m-5">
                  <ImageWatermarkPanel activeTab="img-extract" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
