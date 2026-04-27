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

type PyStatus = 'idle' | 'checking' | 'ok' | 'no-python' | 'no-lib'
type WatermarkQuality = 'invisible' | 'balanced' | 'robust'
type ImageEngine = 'auto' | 'legacy' | 'neural'

interface PanelStatus {
  kind: 'ok' | 'error' | 'warn'
  message: string
}

interface DiagnosticsRecord {
  [key: string]: unknown
}

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
      title="Copy"
      className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer no-drag px-2 py-1 rounded hover:bg-white/[0.06]"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{children}</span>
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
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white ${colors[color]} border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 cursor-pointer no-drag disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {loading ? <CircleNotch size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

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
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-200 bg-black/25 border border-white/[0.07] hover:border-white/[0.15] hover:text-zinc-100 transition-colors cursor-pointer no-drag"
        >
          {icon}
          Browse
        </button>
        <span className="text-xs text-zinc-300 truncate font-mono min-w-0">
          {path || <span className="text-zinc-700">{placeholder}</span>}
        </span>
      </div>
    </div>
  )
}

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

function PwdInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Password</Label>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-full bg-black/25 rounded-lg border border-white/[0.07] focus:border-white/[0.18] text-sm text-white px-3 py-2 focus:outline-none transition-colors duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-[10px] text-zinc-700 px-0.5">Embed and extract must use the same integer password.</span>
    </div>
  )
}

function EngineSelector({ value, onChange }: { value: ImageEngine; onChange: (engine: ImageEngine) => void }) {
  const options: Array<{ id: ImageEngine; label: string; desc: string }> = [
    { id: 'auto', label: 'Auto', desc: 'Short text prefers neural; longer payloads fall back to legacy.' },
    { id: 'legacy', label: 'Legacy', desc: 'Existing DCT + RS engine. Best for longer text and full backward compatibility.' },
    { id: 'neural', label: 'Neural', desc: 'Short payload neural engine with stronger transport robustness.' },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Engine</Label>
      <div className="grid grid-cols-3 gap-1 bg-black/30 rounded-xl border border-white/[0.06] p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg text-center transition-all duration-200 cursor-pointer ${
              value === option.id
                ? 'bg-black/35 border border-white/[0.18] text-white'
                : 'border border-transparent text-zinc-300 hover:bg-white/[0.03] hover:border-white/[0.08]'
            }`}
          >
            <span className="text-xs font-semibold">{option.label}</span>
            <span className="text-[9px] text-zinc-600 leading-tight">{option.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const QUALITY_PRESETS: Array<{ id: WatermarkQuality; label: string; desc: string; hint: string; color: string }> = [
  {
    id: 'invisible',
    label: 'Invisible',
    desc: 'Appearance first',
    hint: 'Legacy uses the lightest perturbation. Neural maps this to its balanced profile.',
    color: 'text-white',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    desc: 'Recommended',
    hint: 'Default tradeoff between image quality and extraction robustness.',
    color: 'text-emerald-400',
  },
  {
    id: 'robust',
    label: 'Robust',
    desc: 'Strongest',
    hint: 'Legacy uses the strongest preset. Neural maps this to its aggressive profile.',
    color: 'text-amber-400',
  },
]

function QualitySelector({ value, onChange }: { value: WatermarkQuality; onChange: (v: WatermarkQuality) => void }) {
  const current = QUALITY_PRESETS.find((preset) => preset.id === value)!
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Quality / strength</Label>
      <div className="grid grid-cols-3 gap-1 bg-black/30 rounded-xl border border-white/[0.06] p-1">
        {QUALITY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all duration-200 cursor-pointer ${
              value === preset.id
                ? 'bg-black/35 border border-white/[0.18]'
                : 'border border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'
            }`}
          >
            <span className={`text-xs font-semibold ${value === preset.id ? preset.color : 'text-zinc-300'}`}>{preset.label}</span>
            <span className="text-[9px] text-zinc-600 leading-tight">{preset.desc}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 px-0.5 leading-relaxed">{current.hint}</p>
    </div>
  )
}

function PythonBanner({
  status,
  version,
  python,
  error,
  runnerMode,
  neuralReady,
  neuralModelVersion,
}: {
  status: PyStatus
  version?: string
  python?: string | null
  error?: string
  runnerMode?: 'exe' | 'python' | null
  neuralReady?: boolean
  neuralModelVersion?: string | null
}) {
  if (status === 'idle' || status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-600 py-1">
        <CircleNotch size={13} className={status === 'checking' ? 'animate-spin' : ''} />
        {status === 'checking' ? 'Checking watermark backend...' : 'Preparing backend check...'}
      </div>
    )
  }

  if (status === 'ok') {
    const runnerText = runnerMode === 'exe' ? 'Bundled helper ready' : `Python backend ready (${python ?? 'unknown'})`
    const neuralText = neuralReady ? `Neural model ready${neuralModelVersion ? ` · ${neuralModelVersion}` : ''}` : 'Neural model not exported yet; auto mode may fall back to legacy.'
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] text-emerald-500/80 py-0.5">
          <CheckCircle size={13} weight="fill" />
          {runnerText}{version ? ` · engine v${version}` : ''}
        </div>
        <StatusBadge kind={neuralReady ? 'ok' : 'warn'} message={neuralText} />
      </div>
    )
  }

  if (status === 'no-lib') {
    return (
      <div className="flex flex-col gap-2">
        <StatusBadge kind="warn" message={`Python was found, but required watermark runtime packages are missing.\n${error ?? ''}`} />
        <div className="flex items-center gap-2">
          <code className="text-xs bg-black/25 border border-white/[0.07] rounded px-3 py-1.5 text-emerald-400 font-mono select-all">
            pip install -r blind_watermark/requirements.txt
          </code>
          <CopyButton text="pip install -r blind_watermark/requirements.txt" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <StatusBadge kind="error" message={error ?? 'No runnable image watermark backend was found.'} />
      <div className="text-[10px] text-zinc-600 space-y-1">
        <div>Developer fallback: install Python and the packaged runtime dependencies.</div>
        <div className="flex items-center gap-2">
          <code className="bg-black/25 border border-white/[0.07] rounded px-3 py-1 text-zinc-200 font-mono select-all">
            pip install -r blind_watermark/requirements.txt
          </code>
          <CopyButton text="pip install -r blind_watermark/requirements.txt" />
        </div>
      </div>
    </div>
  )
}

function DiagnosticsList({ diagnostics }: { diagnostics?: DiagnosticsRecord }) {
  if (!diagnostics || Object.keys(diagnostics).length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(diagnostics).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">{key}</div>
          <div className="text-xs text-zinc-200 break-all mt-1">{typeof value === 'string' ? value : JSON.stringify(value)}</div>
        </div>
      ))}
    </div>
  )
}

function normalizeExtractError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('no valid watermark found')) {
    return 'No extractable watermark was found. Make sure you selected the watermarked image and matched the same password and engine.'
  }
  return message
}

export function ImageEmbedPanel({
  pyStatus,
  python,
  pyVersion,
  pyError,
  runnerMode,
  neuralReady,
  neuralModelVersion,
}: {
  pyStatus: PyStatus
  python?: string | null
  pyVersion?: string
  pyError?: string
  runnerMode?: 'exe' | 'python' | null
  neuralReady?: boolean
  neuralModelVersion?: string | null
}) {
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [wmText, setWmText] = useState('')
  const [pwd, setPwd] = useState(1)
  const [quality, setQuality] = useState<WatermarkQuality>('balanced')
  const [engine, setEngine] = useState<ImageEngine>('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    output: string
    quality: string
    engineUsed?: string
    fallbackUsed?: boolean
    confidence?: number
    diagnostics?: DiagnosticsRecord
  } | null>(null)
  const [status, setStatus] = useState<PanelStatus | null>(null)

  const bytes = new TextEncoder().encode(wmText).length
  const shortPayloadEligible = bytes <= 16

  const handleOpenSrc = useCallback(async () => {
    const path = await window.api.imageWmOpenImage()
    if (path) {
      setInputPath(path)
      setResult(null)
      setStatus(null)
    }
  }, [])

  const handleSaveDst = useCallback(async () => {
    const path = await window.api.imageWmSaveImage()
    if (path) setOutputPath(path)
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
        engine,
      })
      if (res.ok) {
        const finalOutput = res.output ?? outputPath
        void window.api.storeSet('imageWm:lastOutputPath', finalOutput)
        setResult({
          output: finalOutput,
          quality: res.quality ?? quality,
          engineUsed: res.engineUsed,
          fallbackUsed: res.fallbackUsed,
          confidence: res.confidence,
          diagnostics: res.diagnostics,
        })
        const engineInfo = res.fallbackUsed
          ? `Finished with ${res.engineUsed ?? 'legacy'} after fallback.`
          : `Finished with ${res.engineUsed ?? engine}.`
        setStatus({ kind: 'ok', message: `Watermark embed succeeded. ${engineInfo}` })
      } else {
        setStatus({ kind: 'error', message: res.error ?? 'Embed failed' })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, outputPath, wmText, pwd, quality, engine])

  const canRun = pyStatus === 'ok' && !!inputPath && !!outputPath && !!wmText.trim() && !loading

  return (
    <div className="flex flex-col gap-5">
      <PythonBanner
        status={pyStatus}
        version={pyVersion}
        python={python}
        error={pyError}
        runnerMode={runnerMode}
        neuralReady={neuralReady}
        neuralModelVersion={neuralModelVersion}
      />

      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          <PathRow
            label="Source image"
            path={inputPath}
            placeholder="No image selected"
            onBrowse={handleOpenSrc}
            icon={<FolderOpen size={13} />}
          />
          {inputPath && <ImagePreview path={inputPath} label="Preview" />}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Watermark text</Label>
            <textarea
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              placeholder="Enter the text or ID to hide in the image..."
              rows={4}
              spellCheck={false}
              className="w-full bg-black/30 rounded-xl border border-white/[0.06] focus:border-cyan-400/20 text-sm text-white leading-relaxed resize-none px-4 py-3.5 focus:outline-none placeholder:text-zinc-700 transition-all duration-300"
            />
            {wmText && (
              <span className="text-[10px] text-zinc-700 px-1">
                {bytes} bytes
                {!shortPayloadEligible && <span className="text-amber-500/80"> · neural payload limit is 16 bytes, so Auto will fall back to legacy.</span>}
              </span>
            )}
          </div>

          <EngineSelector value={engine} onChange={setEngine} />
          <PwdInput value={pwd} onChange={setPwd} />
          <QualitySelector value={quality} onChange={setQuality} />

          <PathRow
            label="Output path"
            path={outputPath}
            placeholder="No output path selected"
            onBrowse={handleSaveDst}
            icon={<FloppyDisk size={13} />}
          />

          {engine === 'neural' && !shortPayloadEligible && (
            <StatusBadge kind="warn" message="Neural mode only supports short payloads up to 16 UTF-8 bytes. Use Auto or Legacy for longer text." />
          )}

          <ActionButton
            onClick={handleEmbed}
            disabled={!canRun}
            loading={loading}
            icon={<Fingerprint size={15} weight="regular" />}
            label={loading ? 'Embedding...' : 'Embed watermark'}
            color="blue"
          />
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div key="embed-status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StatusBadge kind={status.kind} message={status.message} />
          </motion.div>
        )}
        {result && (
          <motion.div
            key="embed-result"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-black/30 rounded-xl border border-emerald-500/25 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle size={14} weight="fill" />
                  <span className="text-xs font-semibold">Embed complete</span>
                </div>
                <CopyButton text={result.output} />
              </div>
              <div className="text-sm font-medium text-emerald-300 tracking-wide text-center py-2">
                Engine: {result.engineUsed ?? engine}
                {result.fallbackUsed ? ' · fallback used' : ' · direct success'}
                {typeof result.confidence === 'number' && ` · confidence ${Math.round(result.confidence * 100)}%`}
              </div>
              <p className="text-[10px] text-emerald-700/80 text-center mt-1">
                Quality: {result.quality}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <ArrowSquareOut size={12} />
              <span className="font-mono truncate">{result.output}</span>
            </div>
            <DiagnosticsList diagnostics={result.diagnostics} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ImageExtractPanel({
  pyStatus,
  python,
  pyVersion,
  pyError,
  runnerMode,
  neuralReady,
  neuralModelVersion,
}: {
  pyStatus: PyStatus
  python?: string | null
  pyVersion?: string
  pyError?: string
  runnerMode?: 'exe' | 'python' | null
  neuralReady?: boolean
  neuralModelVersion?: string | null
}) {
  const [inputPath, setInputPath] = useState('')
  const [pwd, setPwd] = useState(1)
  const [quality, setQuality] = useState<WatermarkQuality>('balanced')
  const [engine, setEngine] = useState<ImageEngine>('auto')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsRecord | undefined>()
  const [engineUsed, setEngineUsed] = useState<string | undefined>()
  const [confidence, setConfidence] = useState<number | undefined>()
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(false)
  const [status, setStatus] = useState<PanelStatus | null>(null)

  useEffect(() => {
    window.api.storeGet('imageWm:lastOutputPath').then((value) => {
      if (typeof value === 'string' && value) setInputPath(value)
    }).catch(() => undefined)
  }, [])

  const handleOpenImage = useCallback(async () => {
    const path = await window.api.imageWmOpenImage()
    if (path) {
      setInputPath(path)
      setExtracted(null)
      setDiagnostics(undefined)
      setStatus(null)
    }
  }, [])

  const handleExtract = useCallback(async () => {
    if (!inputPath) return
    setLoading(true)
    setExtracted(null)
    setDiagnostics(undefined)
    setStatus(null)
    try {
      const res = await window.api.imageWmExtract({
        inputPath,
        password: pwd,
        quality,
        engine,
      })
      if (res.ok && res.wm != null) {
        setExtracted(res.wm)
        setDiagnostics(res.diagnostics)
        setEngineUsed(res.engineUsed)
        setFallbackUsed(Boolean(res.fallbackUsed))
        setConfidence(res.confidence)
        setStatus({ kind: 'ok', message: 'Watermark extract succeeded.' })
      } else {
        setStatus({ kind: 'error', message: normalizeExtractError(res.error ?? 'Extract failed') })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: normalizeExtractError(String(e)) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, pwd, quality, engine])

  const canRun = pyStatus === 'ok' && !!inputPath && !loading

  return (
    <div className="flex flex-col gap-5">
      <PythonBanner
        status={pyStatus}
        version={pyVersion}
        python={python}
        error={pyError}
        runnerMode={runnerMode}
        neuralReady={neuralReady}
        neuralModelVersion={neuralModelVersion}
      />

      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          <PathRow
            label="Watermarked image"
            path={inputPath}
            placeholder="No image selected"
            onBrowse={handleOpenImage}
            icon={<FolderOpen size={13} />}
          />
          {inputPath && <ImagePreview path={inputPath} label="Preview" />}
        </div>

        <div className="flex flex-col gap-4">
          <StatusBadge kind="warn" message="Auto will try neural first and fall back to legacy. Use explicit engine selection when comparing training iterations." />
          <EngineSelector value={engine} onChange={setEngine} />
          <PwdInput value={pwd} onChange={setPwd} />
          <QualitySelector value={quality} onChange={setQuality} />
          <ActionButton
            onClick={handleExtract}
            disabled={!canRun}
            loading={loading}
            icon={<ScanSmiley size={15} weight="regular" />}
            label={loading ? 'Extracting...' : 'Extract watermark'}
            color="violet"
          />
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div key="extract-status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StatusBadge kind={status.kind} message={status.message} />
          </motion.div>
        )}
        {extracted != null && (
          <motion.div
            key="extracted"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-black/25 rounded-xl border border-emerald-500/20 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Extracted watermark</span>
                <CopyButton text={extracted} />
              </div>
              <p className="text-sm text-emerald-300 leading-relaxed break-all">{extracted}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-xs text-zinc-300">
              Engine: {engineUsed ?? engine}
              {fallbackUsed ? ' · fallback used' : ' · direct success'}
              {typeof confidence === 'number' && ` · confidence ${Math.round(confidence * 100)}%`}
            </div>
            <DiagnosticsList diagnostics={diagnostics} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export type ImageWmSubTab = 'img-embed' | 'img-extract'

export function ImageWatermarkPanel({ activeTab }: { activeTab: ImageWmSubTab }) {
  const [pyStatus, setPyStatus] = useState<PyStatus>('idle')
  const [python, setPython] = useState<string | null>(null)
  const [pyVersion, setPyVersion] = useState<string | undefined>()
  const [pyError, setPyError] = useState<string | undefined>()
  const [runnerMode, setRunnerMode] = useState<'exe' | 'python' | null>(null)
  const [neuralReady, setNeuralReady] = useState(false)
  const [neuralModelVersion, setNeuralModelVersion] = useState<string | null>(null)

  useEffect(() => {
    setPyStatus('checking')
    window.api.imageWmCheckPython().then((res) => {
      setPython(res.python ?? null)
      setRunnerMode((res.mode as 'exe' | 'python') ?? null)
      setNeuralReady(Boolean(res.neuralReady))
      setNeuralModelVersion(res.neuralModelVersion ?? null)
      if (!res.python && res.mode !== 'exe') {
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

  const sharedProps = { pyStatus, python, pyVersion, pyError, runnerMode, neuralReady, neuralModelVersion }

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
