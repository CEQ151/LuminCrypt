import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  FloppyDisk,
  Fingerprint,
  ScanSmiley,
  Copy,
  Check,
  Warning,
  ArrowSquareOut,
  CircleNotch,
  WarningCircle,
  CheckCircle,
} from '@phosphor-icons/react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PyStatus = 'idle' | 'checking' | 'ok' | 'no-python' | 'no-lib'

interface PanelStatus {
  kind: 'ok' | 'error' | 'warn'
  message: string
}

// ─── Shared small helpers ────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [text])
  return (
    <button
      onClick={handle}
      title="复制"
      className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-zinc-200 transition-colors cursor-pointer no-drag px-2 py-1 rounded hover:bg-white/[0.06]"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{children}</span>
  )
}

function StatusBadge({ kind, message }: PanelStatus) {
  const styles = {
    ok: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/25 text-red-300',
    warn: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  }
  const Icon = kind === 'ok' ? CheckCircle : kind === 'warn' ? Warning : WarningCircle
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-xs leading-relaxed border ${styles[kind]}`}>
      <Icon size={13} weight="regular" className="flex-shrink-0 mt-0.5" />
      <span className="whitespace-pre-wrap break-all">{message}</span>
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
  color = 'blue',
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  icon: React.ReactNode
  label: string
  color?: 'blue' | 'violet' | 'emerald'
}) {
  const colors = {
    blue: 'bg-[#3b7cd4] hover:bg-[#4a8ae0]',
    violet: 'bg-violet-600 hover:bg-violet-500',
    emerald: 'bg-emerald-700 hover:bg-emerald-600',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white
        ${colors[color]}
        border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]
        transition-all duration-200 cursor-pointer no-drag
        disabled:opacity-40 disabled:cursor-not-allowed select-none flex-shrink-0
      `}
    >
      {loading ? <CircleNotch size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

/** Display a file path with a "browse" button */
function PathRow({
  label,
  path,
  placeholder,
  onBrowse,
  icon,
}: {
  label: string
  path: string
  placeholder: string
  onBrowse: () => void
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <button
          onClick={onBrowse}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-200 hover:text-zinc-200
            bg-black/25 border border-white/[0.07] hover:border-white/[0.15]
            transition-colors cursor-pointer no-drag flex-shrink-0"
        >
          {icon}
          浏览…
        </button>
        <span className="text-xs text-zinc-300 truncate font-mono min-w-0">
          {path || <span className="text-zinc-700">{placeholder}</span>}
        </span>
      </div>
    </div>
  )
}

/** Integer password input for blind_watermark */
function PwdInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>密码（整数）</Label>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="
          w-full bg-black/25 rounded-lg
          border border-white/[0.07] focus:border-white/[0.18]
          text-sm text-white px-3 py-2
          focus:outline-none transition-colors duration-200
          [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
        "
      />
      <span className="text-[10px] text-zinc-700 px-0.5">
        嵌入和提取必须使用相同密码
      </span>
    </div>
  )
}

// ─── Python environment banner ────────────────────────────────────────────────

function PythonBanner({ status, version, python, error, runnerMode }: {
  status: PyStatus
  version?: string
  python?: string | null
  error?: string
  runnerMode?: 'exe' | 'python' | null
}) {
  if (status === 'idle' || status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-600 py-1">
        <CircleNotch size={13} className={status === 'checking' ? 'animate-spin' : ''} />
        {status === 'checking' ? '正在检测执行引擎…' : '准备检测…'}
      </div>
    )
  }
  if (status === 'ok') {
    if (runnerMode === 'exe') {
      return (
        <div className="flex items-center gap-2 text-[11px] text-emerald-500/80 py-0.5">
          <CheckCircle size={13} weight="fill" />
          内置引擎就绪 · 无需安装 Python
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 text-[11px] text-emerald-500/80 py-0.5">
        <CheckCircle size={13} weight="fill" />
        Python ({python}) + RobustWatermarkEngine {version ? `v${version}` : ''}就绪
      </div>
    )
  }
  if (status === 'no-lib') {
    return (
      <div className="flex flex-col gap-2">
        <StatusBadge
          kind="warn"
          message={`Python (${python}) 已找到，但鲁棒水印依赖未安装。\n${error ?? ''}`}
        />
        <div className="flex items-center gap-2">
          <code className="text-xs bg-black/25 border border-white/[0.07] rounded px-3 py-1.5 text-emerald-400 font-mono select-all">
            pip install numpy opencv-python scipy reedsolo
          </code>
          <CopyButton text="pip install numpy opencv-python scipy reedsolo" />
        </div>
      </div>
    )
  }
  // no-python — either no exe built yet (dev) or missing runner (unlikely in production)
  return (
    <div className="flex flex-col gap-3">
      <StatusBadge
        kind="error"
        message="未找到可用的执行引擎。\n如果你是开发者，请先运行 npm run build:python 构建内置引擎。\n如果你是使用者，请联系开发者重新打包安装。"
      />
      <div className="text-[10px] text-zinc-600 space-y-1">
        <div>开发者可选：安装 Python + 库（无需构建 exe 的快速调试方式）</div>
        <div className="flex items-center gap-2">
          <code className="bg-black/25 border border-white/[0.07] rounded px-3 py-1 text-zinc-200 font-mono select-all">
            pip install numpy opencv-python scipy reedsolo
          </code>
          <CopyButton text="pip install numpy opencv-python scipy reedsolo" />
        </div>
      </div>
    </div>
  )
}

// ─── Image preview ────────────────────────────────────────────────────────────

function ImagePreview({ path, label }: { path: string; label: string }) {
  if (!path) return null
  const fileUrl = 'file:///' + path.replace(/\\/g, '/')
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-black/30 max-h-48 flex items-center justify-center">
        <img
          src={fileUrl}
          alt={label}
          className="max-h-48 max-w-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
    </div>
  )
}

function normalizeExtractError(message: string) {
  const lower = message.toLowerCase()
  if (
    lower.includes('watermark detected but too corrupted to decode') ||
    lower.includes('no valid watermark found')
  ) {
    return '未识别到当前版本可提取水印。常见原因：选了原图而不是导出后的含水印 PNG、密码不一致、或该图是旧版本水印。'
  }
  return message
}

// ─── Robustness presets ───────────────────────────────────────────────────────

type WatermarkQuality = 'invisible' | 'balanced' | 'robust'

const QUALITY_PRESETS: Array<{
  id: WatermarkQuality
  label: string
  desc: string
  hint: string
  color: string
}> = [
  {
    id: 'invisible',
    label: '完全隐形',
    desc: '优先观感',
    hint: '优先保证肉眼不可见，适合高审美图片与海报。RS-16 纠错 + 2 倍冗余。',
    color: 'text-white',
  },
  {
    id: 'balanced',
    label: '均衡',
    desc: '默认推荐',
    hint: '在隐形与鲁棒性之间平衡，适合网络传播。RS-24 纠错 + 3 倍冗余 + 双尺度嵌入（抗 75% 缩放）。',
    color: 'text-emerald-400',
  },
  {
    id: 'robust',
    label: '最强抗性',
    desc: '抗平台干扰',
    hint: '抗平台水印叠加 + 抗降分辨率（最高 50% 缩放）。RS-32 纠错 + 5 倍冗余 + 三尺度嵌入 + 边缘避让。嵌入后自动验证。',
    color: 'text-amber-400',
  },
]

function QualitySelector({
  value,
  onChange,
}: {
  value: WatermarkQuality
  onChange: (v: WatermarkQuality) => void
}) {
  const current = QUALITY_PRESETS.find((p) => p.id === value)!
  return (
    <div className="flex flex-col gap-1.5">
      <Label>质量策略（隐形度 / 鲁棒性）</Label>
      <div
        role="radiogroup"
        aria-label="图片水印质量策略"
        className="grid grid-cols-3 gap-1 bg-black/30 rounded-xl border border-white/[0.06] p-1"
      >
        {QUALITY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={value === preset.id}
            onClick={() => onChange(preset.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onChange(preset.id)
              }
            }}
            className={`
              flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center
              transition-all duration-200 cursor-pointer no-drag
              focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40
              ${value === preset.id
                ? 'bg-black/35 shadow-sm border border-white/[0.18]'
                : 'border border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'
              }
            `}
          >
            <span className={`text-xs font-semibold ${value === preset.id ? preset.color : 'text-zinc-300'}`}>
              {preset.label}
            </span>
            <span className="text-[9px] text-zinc-600 leading-tight">{preset.desc}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 px-0.5 leading-relaxed">
        {current.hint}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE EMBED PANEL
// ─────────────────────────────────────────────────────────────────────────────

export function ImageEmbedPanel({
  pyStatus,
  python,
  pyVersion,
  pyError,
  runnerMode,
}: {
  pyStatus: PyStatus
  python?: string | null
  pyVersion?: string
  pyError?: string
  runnerMode?: 'exe' | 'python' | null
}) {
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [wmText, setWmText] = useState('')
  const [pwd, setPwd] = useState(1)
  const [quality, setQuality] = useState<WatermarkQuality>('balanced')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ output: string; quality: WatermarkQuality } | null>(null)
  const [status, setStatus] = useState<PanelStatus | null>(null)

  const handleOpenSrc = useCallback(async () => {
    const p = await window.api.imageWmOpenImage()
    if (p) { setInputPath(p); setResult(null); setStatus(null) }
  }, [])

  const handleSaveDst = useCallback(async () => {
    const p = await window.api.imageWmSaveImage()
    if (p) setOutputPath(p)
  }, [])

  const handleEmbed = useCallback(async () => {
    if (!inputPath || !outputPath || !wmText.trim()) return
    setLoading(true)
    setResult(null)
    setStatus(null)
    try {
      const res = await window.api.imageWmEmbed({
        inputPath,
        outputPath,
        wmText: wmText.trim(),
        password: pwd,
        quality,
      })
      if (res.ok) {
        const finalOutput = res.output ?? outputPath
        void window.api.storeSet('imageWm:lastOutputPath', finalOutput)
        setResult({ output: finalOutput, quality })
        setStatus({ kind: 'ok', message: '水印嵌入成功！提取时只需图片和密码，无需再记录 wm_shape。' })
      } else {
        setStatus({ kind: 'error', message: res.error ?? '嵌入失败' })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, outputPath, wmText, pwd, quality])

  const canRun = pyStatus === 'ok' && !!inputPath && !!outputPath && !!wmText.trim() && !loading

  return (
    <div className="flex flex-col gap-5">
      <PythonBanner status={pyStatus} version={pyVersion} python={python} error={pyError} runnerMode={runnerMode} />

      <div className="grid grid-cols-2 gap-5">
        {/* Left col */}
        <div className="flex flex-col gap-4">
          <PathRow
            label="源图片"
            path={inputPath}
            placeholder="未选择图片"
            onBrowse={handleOpenSrc}
            icon={<FolderOpen size={13} />}
          />
          {inputPath && <ImagePreview path={inputPath} label="预览" />}
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          {/* Watermark text */}
          <div className="flex flex-col gap-1.5">
            <Label>水印文本</Label>
            <textarea
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              placeholder="输入要隐藏在图片中的文本…"
              rows={4}
              spellCheck={false}
              className="
                w-full bg-black/30 rounded-xl
                border border-white/[0.06] focus:border-cyan-400/20
                text-sm text-white leading-relaxed resize-none
                px-4 py-3.5 focus:outline-none
                placeholder:text-zinc-700 transition-all duration-300
              "
            />
            {wmText && (
              <span className="text-[10px] text-zinc-700 px-1">
                {new TextEncoder().encode(wmText).length} 字节 · 文本越长需要图片越大
              </span>
            )}
          </div>

          <PwdInput value={pwd} onChange={setPwd} />

          <QualitySelector value={quality} onChange={setQuality} />

          <PathRow
            label="保存路径（PNG）"
            path={outputPath}
            placeholder="未选择保存位置"
            onBrowse={handleSaveDst}
            icon={<FloppyDisk size={13} />}
          />

          <ActionButton
            onClick={handleEmbed}
            disabled={!canRun}
            loading={loading}
            icon={<Fingerprint size={15} weight="regular" />}
            label={loading ? '嵌入中…' : '嵌入水印'}
            color="blue"
          />
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div key="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StatusBadge kind={status.kind} message={status.message} />
          </motion.div>
        )}
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-black/30 rounded-xl border border-emerald-500/25 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle size={14} weight="fill" />
                  <span className="text-xs font-semibold">嵌入完成</span>
                </div>
                <CopyButton text={result.output} />
              </div>
              <div className="text-sm font-medium text-emerald-300 tracking-wide text-center py-2">
                已写入不可见水印 · 自检通过 · 支持旋转/缩放/压缩/平台水印叠加后的鲁棒提取
              </div>
              {(() => {
                const preset = QUALITY_PRESETS.find((p) => p.id === result.quality)!
                return (
                  <p className="text-[10px] text-emerald-700/80 text-center mt-1">
                    鲁棒性：<span className={preset.color}>{preset.label}（{preset.desc}）</span>
                    {result.quality === 'robust' && ' · 多尺度嵌入 + 边缘避让'}
                  </p>
                )
              })()}
            </div>

            {/* Output file info */}
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <ArrowSquareOut size={12} />
              <span className="font-mono truncate">{result.output}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE EXTRACT PANEL
// ─────────────────────────────────────────────────────────────────────────────

export function ImageExtractPanel({
  pyStatus,
  python,
  pyVersion,
  pyError,
  runnerMode,
}: {
  pyStatus: PyStatus
  python?: string | null
  pyVersion?: string
  pyError?: string
  runnerMode?: 'exe' | 'python' | null
}) {
  const [inputPath, setInputPath] = useState('')
  const [pwd, setPwd] = useState(1)
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<string | null>(null)
  const [status, setStatus] = useState<PanelStatus | null>(null)

  useEffect(() => {
    window.api.storeGet('imageWm:lastOutputPath').then((v) => {
      if (typeof v === 'string' && v) setInputPath(v)
    }).catch(() => undefined)
  }, [])

  const handleOpenImage = useCallback(async () => {
    const p = await window.api.imageWmOpenImage()
    if (p) { setInputPath(p); setExtracted(null); setStatus(null) }
  }, [])

  const handleExtract = useCallback(async () => {
    if (!inputPath) return
    setLoading(true)
    setExtracted(null)
    setStatus(null)
    try {
      const res = await window.api.imageWmExtract({
        inputPath,
        password: pwd,
      })
      if (res.ok && res.wm != null) {
        setExtracted(res.wm)
        setStatus({ kind: 'ok', message: '水印提取成功！' })
      } else {
        setStatus({ kind: 'error', message: normalizeExtractError(res.error ?? '提取失败') })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: normalizeExtractError(String(e)) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, pwd])

  const canRun = pyStatus === 'ok' && !!inputPath && !loading

  return (
    <div className="flex flex-col gap-5">
      <PythonBanner status={pyStatus} version={pyVersion} python={python} error={pyError} runnerMode={runnerMode} />

      <div className="grid grid-cols-2 gap-5">
        {/* Left col */}
        <div className="flex flex-col gap-4">
          <PathRow
            label="含水印图片"
            path={inputPath}
            placeholder="未选择图片"
            onBrowse={handleOpenImage}
            icon={<FolderOpen size={13} />}
          />
          {inputPath && <ImagePreview path={inputPath} label="预览" />}
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          <StatusBadge
            kind="warn"
            message="新引擎提取时无需 wm_shape。仅需选择图片并输入嵌入时的同一密码。"
          />

          <PwdInput value={pwd} onChange={setPwd} />

          <ActionButton
            onClick={handleExtract}
            disabled={!canRun}
            loading={loading}
            icon={<ScanSmiley size={15} weight="regular" />}
            label={loading ? '提取中…' : '提取水印'}
            color="violet"
          />
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div key="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StatusBadge kind={status.kind} message={status.message} />
          </motion.div>
        )}
        {extracted != null && (
          <motion.div
            key="extracted"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-black/25 rounded-xl border border-emerald-500/20 px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                提取的水印文本
              </span>
              <CopyButton text={extracted} />
            </div>
            <p className="text-sm text-emerald-300 font-['Geist',sans-serif] leading-relaxed break-all">
              {extracted}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: shared Python state provider wrapper
// ─────────────────────────────────────────────────────────────────────────────

export type ImageWmSubTab = 'img-embed' | 'img-extract'

export function ImageWatermarkPanel({ activeTab }: { activeTab: ImageWmSubTab }) {
  const [pyStatus, setPyStatus] = useState<PyStatus>('idle')
  const [python, setPython] = useState<string | null>(null)
  const [pyVersion, setPyVersion] = useState<string | undefined>()
  const [pyError, setPyError] = useState<string | undefined>()
  const [runnerMode, setRunnerMode] = useState<'exe' | 'python' | null>(null)

  useEffect(() => {
    setPyStatus('checking')
    window.api.imageWmCheckPython().then((res) => {
      setPython(res.python ?? null)
      setRunnerMode((res.mode as 'exe' | 'python') ?? null)
      if (res.mode === 'exe' && res.ok) {
        setPyStatus('ok')
        setPyVersion(res.version)
      } else if (!res.python) {
        setPyStatus('no-python')
        setPyError(res.error)
      } else if (!res.ok) {
        setPyStatus('no-lib')
        setPyError(res.error)
      } else {
        setPyStatus('ok')
        setPyVersion(res.version)
      }
    }).catch((e) => {
      setPyStatus('no-python')
      setPyError(String(e))
    })
  }, [])

  const sharedProps = { pyStatus, python, pyVersion, pyError, runnerMode }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col">
      <AnimatePresence mode="wait">
        {activeTab === 'img-embed' && (
          <motion.div key="img-embed" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1">
            <ImageEmbedPanel {...sharedProps} />
          </motion.div>
        )}
        {activeTab === 'img-extract' && (
          <motion.div key="img-extract" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1">
            <ImageExtractPanel {...sharedProps} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
