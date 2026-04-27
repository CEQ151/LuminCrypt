import { useState, useEffect, useCallback, type ReactElement, type ReactNode } from 'react'
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
  ImagesSquare,
  X,
  Question
} from '@phosphor-icons/react'
import { I18nKey, useI18n } from '../i18n'

type PyStatus = 'idle' | 'checking' | 'ok' | 'no-python' | 'no-lib'
type WatermarkQuality = 'trace' | 'faint' | 'light' | 'balanced' | 'strong' | 'robust'
type ImageEngine = 'auto' | 'legacy' | 'neural'
type ImagePayloadMode = 'fingerprint64' | 'text16'
type SelfCheckMode = 'sampled' | 'all' | 'off'

interface PanelStatus {
  kind: 'ok' | 'error' | 'warn'
  message: string
  code?: string
  hints?: string[]
}

interface DiagnosticsRecord {
  [key: string]: unknown
}

interface BatchProgress {
  event?: 'progress' | 'complete'
  batchId: string
  index?: number
  total?: number
  input?: string
  output?: string
  status?: 'running' | 'done' | 'failed'
  progress?: number
  failureCode?: string
  error?: string
}

interface BatchSummary {
  ok: boolean
  batchId?: string
  total?: number
  successCount?: number
  failureCount?: number
  failureCode?: string | null
  error?: string
}

type Translate = (key: I18nKey, params?: Record<string, string | number>) => string

function CopyButton({
  text,
  labelKey = 'common.copy'
}: {
  text: string
  labelKey?: I18nKey
}): ReactElement {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [text])
  return (
    <button
      onClick={handle}
      title={t(labelKey)}
      className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer no-drag px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06]"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {copied ? t('common.copied') : t(labelKey)}
    </button>
  )
}

function Label({ children }: { children: ReactNode }): ReactElement {
  return <span className="text-sm font-semibold text-zinc-200">{children}</span>
}

function HelpText({ children }: { children: ReactNode }): ReactElement {
  return <span className="text-xs text-zinc-400 leading-relaxed px-0.5">{children}</span>
}

function StatusBadge({ kind, message }: PanelStatus): ReactElement {
  const styles = {
    ok: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
    error: 'bg-red-500/10 border-red-500/25 text-red-200',
    warn: 'bg-amber-500/10 border-amber-500/25 text-amber-200'
  }
  const Icon = kind === 'ok' ? CheckCircle : kind === 'warn' ? Warning : WarningCircle
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed border ${styles[kind]}`}
    >
      <Icon size={16} weight="regular" className="flex-shrink-0 mt-0.5" />
      <span className="whitespace-pre-wrap break-words">{message}</span>
    </div>
  )
}

function FailureNotice({
  code,
  message,
  hints
}: {
  code?: string
  message?: string
  hints?: string[]
}): ReactElement {
  const { t } = useI18n()
  const fallback = failureText(code, message, t)
  const recoveryHints = hints && hints.length > 0 ? hints : failureHints(code, t)
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <div className="flex items-start gap-2.5">
        <WarningCircle size={16} weight="regular" className="mt-0.5 flex-shrink-0 text-red-300" />
        <div className="min-w-0">
          <p className="font-semibold leading-relaxed">{fallback}</p>
          {recoveryHints.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-red-100/80">
              {recoveryHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
  color = 'blue'
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  icon: ReactNode
  label: string
  color?: 'blue' | 'violet' | 'emerald'
}): ReactElement {
  const colors = {
    blue: 'bg-[#3b7cd4] hover:bg-[#4a8ae0]',
    violet: 'bg-violet-600 hover:bg-violet-500',
    emerald: 'bg-emerald-700 hover:bg-emerald-600'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white ${colors[color]} border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 cursor-pointer no-drag disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]`}
    >
      {loading ? <CircleNotch size={16} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

function PathRow({
  label,
  path,
  placeholder,
  onBrowse,
  icon
}: {
  label: string
  path: string
  placeholder: string
  onBrowse: () => void
  icon: ReactNode
}): ReactElement {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/25 p-2">
        <button
          onClick={onBrowse}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm text-zinc-100 bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.16] transition-colors cursor-pointer no-drag"
        >
          {icon}
          {t('common.browse')}
        </button>
        <span className="text-sm text-zinc-300 truncate font-mono min-w-0">
          {path || <span className="text-zinc-500 font-sans">{placeholder}</span>}
        </span>
      </div>
    </div>
  )
}

function ImagePreview({ path, label }: { path: string; label: string }): ReactElement | null {
  if (!path) return null
  const fileUrl = 'file:///' + path.replace(/\\/g, '/')
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black/30 max-h-64 flex items-center justify-center">
        <img
          src={fileUrl}
          alt={label}
          className="max-h-64 max-w-full object-contain"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
    </div>
  )
}

function PwdInput({
  value,
  onChange
}: {
  value: number
  onChange: (v: number) => void
}): ReactElement {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.password')}</Label>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-full bg-black/25 rounded-xl border border-white/[0.08] focus:border-white/[0.18] text-base text-white px-4 py-3 focus:outline-none transition-colors duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <HelpText>{t('img.passwordHelp')}</HelpText>
    </div>
  )
}

function EngineSelector({
  value,
  onChange
}: {
  value: ImageEngine
  onChange: (engine: ImageEngine) => void
}): ReactElement {
  const { t } = useI18n()
  const options: Array<{ id: ImageEngine; label: string; desc: string }> = [
    { id: 'auto', label: t('img.engine.auto'), desc: t('img.engine.autoDesc') },
    { id: 'legacy', label: t('img.engine.legacy'), desc: t('img.engine.legacyDesc') },
    { id: 'neural', label: t('img.engine.neural'), desc: t('img.engine.neuralDesc') }
  ]

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.engine')}</Label>
      <div className="grid grid-cols-3 gap-2 bg-black/25 rounded-xl border border-white/[0.08] p-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`flex min-h-[86px] flex-col items-start justify-start gap-1.5 rounded-lg px-3 py-3 text-left transition-all duration-200 cursor-pointer border ${
              value === option.id
                ? 'bg-white/[0.1] border-white/[0.18] text-white'
                : 'border-transparent text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.08]'
            }`}
          >
            <span className="text-sm font-semibold">{option.label}</span>
            <span className="text-xs text-zinc-400 leading-relaxed">{option.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PayloadModeSelector({
  value,
  onChange
}: {
  value: ImagePayloadMode
  onChange: (mode: ImagePayloadMode) => void
}): ReactElement {
  const { t } = useI18n()
  const options: Array<{ id: ImagePayloadMode; label: string; desc: string }> = [
    { id: 'fingerprint64', label: t('img.payload.fingerprint'), desc: t('img.payload.fingerprintDesc') },
    { id: 'text16', label: t('img.payload.text16'), desc: t('img.payload.text16Desc') }
  ]

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.payloadMode')}</Label>
      <div className="grid grid-cols-2 gap-2 bg-black/25 rounded-xl border border-white/[0.08] p-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-3 py-2 text-left transition-all duration-200 ${
              value === option.id
                ? 'bg-cyan-400/15 text-cyan-100 border border-cyan-300/20'
                : 'text-zinc-400 border border-transparent hover:bg-white/[0.04]'
            }`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="block text-xs leading-snug mt-1">{option.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function QualitySelector({
  value,
  onChange
}: {
  value: WatermarkQuality
  onChange: (v: WatermarkQuality) => void
}): ReactElement {
  const { t } = useI18n()
  const presets: Array<{
    id: WatermarkQuality
    label: string
    desc: string
    hint: string
    color: string
  }> = [
    {
      id: 'trace',
      label: t('img.quality.trace'),
      desc: t('img.quality.traceDesc'),
      hint: t('img.quality.traceHint'),
      color: 'text-zinc-200'
    },
    {
      id: 'faint',
      label: t('img.quality.faint'),
      desc: t('img.quality.faintDesc'),
      hint: t('img.quality.faintHint'),
      color: 'text-sky-200'
    },
    {
      id: 'light',
      label: t('img.quality.light'),
      desc: t('img.quality.lightDesc'),
      hint: t('img.quality.lightHint'),
      color: 'text-cyan-200'
    },
    {
      id: 'balanced',
      label: t('img.quality.balanced'),
      desc: t('img.quality.balancedDesc'),
      hint: t('img.quality.balancedHint'),
      color: 'text-emerald-300'
    },
    {
      id: 'strong',
      label: t('img.quality.strong'),
      desc: t('img.quality.strongDesc'),
      hint: t('img.quality.strongHint'),
      color: 'text-orange-300'
    },
    {
      id: 'robust',
      label: t('img.quality.robust'),
      desc: t('img.quality.robustDesc'),
      hint: t('img.quality.robustHint'),
      color: 'text-amber-300'
    }
  ]
  const current = presets.find((preset) => preset.id === value)!

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.strength')}</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-black/25 rounded-xl border border-white/[0.08] p-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={`flex min-h-[76px] flex-col items-start gap-1 rounded-lg px-3 py-3 text-left transition-all duration-200 cursor-pointer border ${
              value === preset.id
                ? 'bg-white/[0.1] border-white/[0.18]'
                : 'border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]'
            }`}
          >
            <span
              className={`text-sm font-semibold ${value === preset.id ? preset.color : 'text-zinc-300'}`}
            >
              {preset.label}
            </span>
            <span className="text-xs text-zinc-400 leading-relaxed">{preset.desc}</span>
          </button>
        ))}
      </div>
      <HelpText>{current.hint}</HelpText>
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
  neuralModelVersion
}: {
  status: PyStatus
  version?: string
  python?: string | null
  error?: string
  runnerMode?: 'exe' | 'python' | null
  neuralReady?: boolean
  neuralModelVersion?: string | null
}): ReactElement {
  const { t } = useI18n()
  if (status === 'idle' || status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400 py-1">
        <CircleNotch size={15} className={status === 'checking' ? 'animate-spin' : ''} />
        {status === 'checking' ? t('img.backend.checking') : t('img.backend.preparing')}
      </div>
    )
  }

  if (status === 'ok') {
    const runnerText =
      runnerMode === 'exe'
        ? t('img.backend.exeReady')
        : t('img.backend.pythonReady', { python: python ?? 'unknown' })
    const neuralText = neuralReady
      ? t('img.backend.neuralReady', {
          version: neuralModelVersion ? ` · ${neuralModelVersion}` : ''
        })
      : t('img.backend.neuralMissing')
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-emerald-300 py-0.5">
          <CheckCircle size={15} weight="fill" />
          {runnerText}
          {version ? ` · engine v${version}` : ''}
        </div>
        <StatusBadge kind={neuralReady ? 'ok' : 'warn'} message={neuralText} />
      </div>
    )
  }

  if (status === 'no-lib') {
    return (
      <div className="flex flex-col gap-2">
        <StatusBadge kind="warn" message={t('img.backend.missingLib', { error: error ?? '' })} />
        <div className="flex items-center gap-2">
          <code className="text-sm bg-black/25 border border-white/[0.08] rounded-lg px-3 py-2 text-emerald-300 font-mono select-all">
            pip install -r blind_watermark/requirements.txt
          </code>
          <CopyButton text="pip install -r blind_watermark/requirements.txt" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <StatusBadge kind="error" message={error ?? t('img.backend.noRunner')} />
      <div className="text-xs text-zinc-400 space-y-2">
        <div>{t('img.backend.devFallback')}</div>
        <div className="flex items-center gap-2">
          <code className="bg-black/25 border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-200 font-mono select-all">
            pip install -r blind_watermark/requirements.txt
          </code>
          <CopyButton text="pip install -r blind_watermark/requirements.txt" />
        </div>
      </div>
    </div>
  )
}

function DiagnosticsList({
  diagnostics
}: {
  diagnostics?: DiagnosticsRecord
}): ReactElement | null {
  const { t } = useI18n()
  if (!diagnostics || Object.keys(diagnostics).length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.diagnostics')}</Label>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(diagnostics).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
              {diagnosticLabel(key, t)}
              <InfoTip text={diagnosticHelp(key, t)} />
            </div>
            <div className="text-xs text-zinc-400 break-all mt-1.5">
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoTip({ text }: { text: string }): ReactElement {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.16] text-[10px] text-zinc-400">
        <Question size={10} weight="bold" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-56 -translate-x-1/2 rounded-lg border border-white/[0.12] bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  )
}

function diagnosticLabel(key: string, t: Translate): string {
  const labels: Record<string, I18nKey> = {
    profile: 'diag.profile',
    codec: 'diag.codec',
    protocol: 'diag.protocol',
    passwordProtected: 'diag.passwordProtected',
    visualStrength: 'diag.visualStrength',
    chromaScale: 'diag.chromaScale',
    textureFloor: 'diag.textureFloor',
    selfCheckRequired: 'diag.selfCheckRequired',
    selfCheckPassed: 'diag.selfCheckPassed',
    payloadMode: 'diag.payloadMode',
    fingerprint: 'diag.fingerprint',
    payloadBytes: 'diag.payloadBytes',
    modelVersion: 'diag.modelVersion',
    modelsDir: 'diag.modelsDir',
    fallbackReason: 'diag.fallbackReason',
    bitConfidence: 'diag.bitConfidence',
    decodeStrategy: 'diag.decodeStrategy',
    geometricCorrection: 'diag.geometricCorrection',
    warnings: 'diag.warnings',
    spreadDelta: 'diag.spreadDelta',
    spreadReps: 'diag.spreadReps',
    spreadMaskFloor: 'diag.spreadMaskFloor',
    spreadMaskGain: 'diag.spreadMaskGain',
    spreadBlocks: 'diag.spreadBlocks',
    berEstimate: 'diag.berEstimate',
    spreadConfidence: 'diag.spreadConfidence'
  }
  const labelKey = labels[key]
  return labelKey ? t(labelKey) : key
}

function diagnosticHelp(key: string, t: Translate): string {
  const helps: Record<string, I18nKey> = {
    profile: 'diagHelp.profile',
    codec: 'diagHelp.codec',
    protocol: 'diagHelp.protocol',
    passwordProtected: 'diagHelp.passwordProtected',
    visualStrength: 'diagHelp.visualStrength',
    chromaScale: 'diagHelp.chromaScale',
    textureFloor: 'diagHelp.textureFloor',
    selfCheckRequired: 'diagHelp.selfCheckRequired',
    selfCheckPassed: 'diagHelp.selfCheckPassed',
    payloadMode: 'diagHelp.payloadMode',
    fingerprint: 'diagHelp.fingerprint',
    payloadBytes: 'diagHelp.payloadBytes',
    modelVersion: 'diagHelp.modelVersion',
    modelsDir: 'diagHelp.modelsDir',
    fallbackReason: 'diagHelp.fallbackReason',
    bitConfidence: 'diagHelp.bitConfidence',
    decodeStrategy: 'diagHelp.decodeStrategy',
    geometricCorrection: 'diagHelp.geometricCorrection',
    warnings: 'diagHelp.warnings',
    spreadDelta: 'diagHelp.spreadDelta',
    spreadReps: 'diagHelp.spreadReps',
    spreadMaskFloor: 'diagHelp.spreadMaskFloor',
    spreadMaskGain: 'diagHelp.spreadMaskGain',
    spreadBlocks: 'diagHelp.spreadBlocks',
    berEstimate: 'diagHelp.berEstimate',
    spreadConfidence: 'diagHelp.spreadConfidence'
  }
  const helpKey = helps[key]
  return helpKey ? t(helpKey) : t('diagHelp.default')
}

function failureText(code: string | undefined, message: string | undefined, t: Translate): string {
  const keys: Record<string, I18nKey> = {
    invalid_request: 'failure.invalidRequest',
    input_unreadable: 'failure.inputUnreadable',
    model_unavailable: 'failure.modelUnavailable',
    payload_too_long: 'failure.payloadTooLong',
    no_signal: 'failure.noSignal',
    wrong_password_or_corrupted_payload: 'failure.wrongPasswordOrCorrupted',
    engine_mismatch: 'failure.engineMismatch',
    unsupported_protocol: 'failure.unsupportedProtocol',
    batch_partial_failure: 'failure.batchPartial',
    batch_cancelled: 'failure.batchCancelled'
  }
  const key = code ? keys[code] : undefined
  return key ? t(key) : message || t('failure.default')
}

function failureHints(code: string | undefined, t: Translate): string[] {
  const keys: Record<string, I18nKey> = {
    invalid_request: 'failureHints.invalidRequest',
    input_unreadable: 'failureHints.inputUnreadable',
    model_unavailable: 'failureHints.modelUnavailable',
    payload_too_long: 'failureHints.payloadTooLong',
    no_signal: 'failureHints.noSignal',
    wrong_password_or_corrupted_payload: 'failureHints.wrongPasswordOrCorrupted',
    engine_mismatch: 'failureHints.engineMismatch',
    unsupported_protocol: 'failureHints.unsupportedProtocol',
    batch_partial_failure: 'failureHints.batchPartial',
    batch_cancelled: 'failureHints.batchCancelled'
  }
  const key = code ? keys[code] : undefined
  return (key ? t(key) : t('failureHints.default')).split('|').filter(Boolean)
}

function ResultMeta({
  engine,
  fallback,
  confidence
}: {
  engine: string
  fallback?: boolean
  confidence?: number
}): ReactElement {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-zinc-200">
      {t('img.engineResult', { engine })}
      <span className="text-zinc-400">
        {' · '}
        {fallback ? t('img.fallbackUsed') : t('img.directSuccess')}
        {typeof confidence === 'number' &&
          ` · ${t('img.confidence', { value: Math.round(confidence * 100) })}`}
      </span>
    </div>
  )
}

export function ImageEmbedPanel({
  pyStatus,
  python,
  pyVersion,
  pyError,
  runnerMode,
  neuralReady,
  neuralModelVersion
}: {
  pyStatus: PyStatus
  python?: string | null
  pyVersion?: string
  pyError?: string
  runnerMode?: 'exe' | 'python' | null
  neuralReady?: boolean
  neuralModelVersion?: string | null
}): ReactElement {
  const { t } = useI18n()
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [batchInputPaths, setBatchInputPaths] = useState<string[]>([])
  const [batchOutputDir, setBatchOutputDir] = useState('')
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchResult, setBatchResult] = useState<BatchSummary | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [selfCheckMode, setSelfCheckMode] = useState<SelfCheckMode>('sampled')
  const [wmText, setWmText] = useState('')
  const [pwd, setPwd] = useState(1)
  const [quality, setQuality] = useState<WatermarkQuality>('light')
  const [engine, setEngine] = useState<ImageEngine>('auto')
  const [payloadMode, setPayloadMode] = useState<ImagePayloadMode>('fingerprint64')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    output: string
    quality: string
    engineUsed?: string
    fallbackUsed?: boolean
    confidence?: number
    diagnostics?: DiagnosticsRecord
    warnings?: string[]
  } | null>(null)
  const [status, setStatus] = useState<PanelStatus | null>(null)

  const bytes = new TextEncoder().encode(wmText).length
  const shortPayloadEligible = bytes <= 16
  const batchPercent = Math.round((batchProgress?.progress ?? 0) * 100)

  useEffect(() => {
    return window.api.onImageWmBatchProgress((payload) => {
      if (payload.event === 'complete') {
        setBatchProgress({ ...payload, progress: 1 })
        setBatchRunning(false)
        setBatchResult(payload as BatchSummary)
      } else {
        setBatchProgress(payload)
      }
    })
  }, [])

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

  const handleOpenBatch = useCallback(async () => {
    const paths = await window.api.imageWmOpenImages()
    if (paths.length) {
      setBatchInputPaths(paths)
      setBatchProgress(null)
      setBatchResult(null)
      setStatus(null)
    }
  }, [])

  const handleOutputDir = useCallback(async () => {
    const dir = await window.api.imageWmChooseOutputDir()
    if (dir) setBatchOutputDir(dir)
  }, [])

  const handleBatchEmbed = useCallback(async () => {
    if (!batchInputPaths.length || !batchOutputDir || !wmText.trim()) return
    setBatchRunning(true)
    setBatchProgress(null)
    setBatchResult(null)
    setStatus(null)
    try {
      const res = await window.api.imageWmEmbedBatch({
        inputPaths: batchInputPaths,
        outputDir: batchOutputDir,
        wmText: wmText.trim(),
        password: pwd,
        quality,
        engine,
        payloadMode,
        selfCheckMode
      })
      setBatchRunning(false)
      setBatchResult(res)
      if (res.ok) {
        setStatus({
          kind: 'ok',
          message: t('img.batchOk', { count: res.successCount ?? batchInputPaths.length })
        })
      } else {
        setStatus({
          kind: 'error',
          code: res.failureCode ?? undefined,
          message: failureText(res.failureCode ?? undefined, res.error ?? t('img.batchFail'), t)
        })
      }
    } catch (e) {
      setBatchRunning(false)
      setStatus({ kind: 'error', message: String(e) })
    }
  }, [batchInputPaths, batchOutputDir, wmText, pwd, quality, engine, payloadMode, selfCheckMode, t])

  const handleCancelBatch = useCallback(async () => {
    const batchId = batchProgress?.batchId ?? batchResult?.batchId
    if (batchId) await window.api.imageWmCancelBatch(batchId)
    setBatchRunning(false)
  }, [batchProgress?.batchId, batchResult?.batchId])

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
        payloadMode
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
          warnings: res.warnings
        })
        const engineInfo = res.fallbackUsed
          ? `${res.engineUsed ?? 'legacy'} · ${t('img.fallbackUsed')}`
          : `${res.engineUsed ?? engine} · ${t('img.directSuccess')}`
        const hasWarning = Boolean(res.warningCode || (res.warnings && res.warnings.length > 0))
        setStatus({
          kind: hasWarning ? 'warn' : 'ok',
          message: hasWarning
            ? t('img.embedOkWithRisk', { engineInfo })
            : t('img.embedOk', { engineInfo })
        })
      } else {
        setStatus({
          kind: 'error',
          code: res.failureCode,
          message: failureText(
            res.failureCode,
            res.userMessage ?? res.error ?? t('img.embedFail'),
            t
          ),
          hints: res.recoveryHints
        })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, outputPath, wmText, pwd, quality, engine, payloadMode, t])

  const canRun = pyStatus === 'ok' && !!inputPath && !!outputPath && !!wmText.trim() && !loading
  const canBatch =
    pyStatus === 'ok' &&
    batchInputPaths.length > 0 &&
    !!batchOutputDir &&
    !!wmText.trim() &&
    !batchRunning

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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,0.9fr)_minmax(420px,1.1fr)] gap-6">
        <div className="flex flex-col gap-4">
          <PathRow
            label={t('img.source')}
            path={inputPath}
            placeholder={t('img.noImage')}
            onBrowse={handleOpenSrc}
            icon={<FolderOpen size={15} />}
          />
          {inputPath && <ImagePreview path={inputPath} label={t('img.preview')} />}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t('img.text')}</Label>
            <textarea
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              placeholder={t('img.textPlaceholder')}
              rows={4}
              spellCheck={false}
              className="w-full bg-black/30 rounded-xl border border-white/[0.08] focus:border-cyan-400/25 text-base text-white leading-relaxed resize-none px-4 py-3.5 focus:outline-none placeholder:text-zinc-500 transition-all duration-300"
            />
            {wmText && (
              <HelpText>
                {bytes} bytes
                {!shortPayloadEligible && (
                  <span className="text-amber-300"> · {t('img.neuralLimitInline')}</span>
                )}
              </HelpText>
            )}
          </div>

          <EngineSelector value={engine} onChange={setEngine} />
          <PayloadModeSelector value={payloadMode} onChange={setPayloadMode} />
          <PwdInput value={pwd} onChange={setPwd} />
          <QualitySelector value={quality} onChange={setQuality} />

          <PathRow
            label={t('img.output')}
            path={outputPath}
            placeholder={t('img.noOutput')}
            onBrowse={handleSaveDst}
            icon={<FloppyDisk size={15} />}
          />

          {engine === 'neural' && payloadMode === 'text16' && !shortPayloadEligible && (
            <StatusBadge kind="warn" message={t('img.neuralLimitWarn')} />
          )}

          <ActionButton
            onClick={handleEmbed}
            disabled={!canRun}
            loading={loading}
            icon={<Fingerprint size={16} weight="regular" />}
            label={loading ? t('img.embedding') : t('img.embed')}
            color="blue"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{t('img.batchTitle')}</h3>
            <p className="mt-1 text-xs text-zinc-400">{t('img.batchSubtitle')}</p>
          </div>
          {batchInputPaths.length > 0 && (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
              {t('img.batchSelected', { count: batchInputPaths.length })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr]">
          <PathRow
            label={t('img.batchImages')}
            path={
              batchInputPaths.length > 0
                ? t('img.batchSelected', { count: batchInputPaths.length })
                : ''
            }
            placeholder={t('img.batchNoImages')}
            onBrowse={handleOpenBatch}
            icon={<ImagesSquare size={15} />}
          />
          <PathRow
            label={t('img.batchOutputDir')}
            path={batchOutputDir}
            placeholder={t('img.batchNoOutputDir')}
            onBrowse={handleOutputDir}
            icon={<FolderOpen size={15} />}
          />
        </div>

        {batchInputPaths.length > 0 && (
          <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
            {batchInputPaths.slice(0, 20).map((path) => (
              <span
                key={path}
                className="max-w-[240px] truncate rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs font-mono text-zinc-400"
              >
                {path}
              </span>
            ))}
            {batchInputPaths.length > 20 && (
              <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-zinc-400">
                {t('img.batchMore', { count: batchInputPaths.length - 20 })}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/25 p-1">
            {(['sampled', 'all', 'off'] as SelfCheckMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSelfCheckMode(mode)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer no-drag ${
                  selfCheckMode === mode
                    ? 'bg-white/[0.1] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t(`img.selfCheck.${mode}` as I18nKey)}
              </button>
            ))}
          </div>
          <ActionButton
            onClick={handleBatchEmbed}
            disabled={!canBatch}
            loading={batchRunning}
            icon={<ImagesSquare size={16} weight="regular" />}
            label={batchRunning ? t('img.batchRunning') : t('img.batchStart')}
            color="emerald"
          />
          {batchRunning && (
            <button
              type="button"
              onClick={handleCancelBatch}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/15 cursor-pointer no-drag"
            >
              <X size={13} />
              {t('img.batchCancel')}
            </button>
          )}
        </div>

        {(batchRunning || batchProgress || batchResult) && (
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-300">
              <span>
                {batchProgress?.input
                  ? t('img.batchCurrent', { name: batchProgress.input })
                  : t('img.batchProgress')}
              </span>
              <span>{batchPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width]"
                style={{ width: `${batchPercent}%` }}
              />
            </div>
            {batchResult && (
              <div className="mt-3 text-sm text-zinc-300">
                {t('img.batchSummary', {
                  success: batchResult.successCount ?? 0,
                  failed: batchResult.failureCount ?? 0,
                  total: batchResult.total ?? batchInputPaths.length
                })}
              </div>
            )}
            {batchProgress?.status === 'failed' && (
              <p className="mt-2 text-xs text-red-200">
                {failureText(batchProgress.failureCode, batchProgress.error, t)}
              </p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {status && (
          <motion.div
            key="embed-status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {status.kind === 'error' ? (
              <FailureNotice code={status.code} message={status.message} hints={status.hints} />
            ) : (
              <StatusBadge kind={status.kind} message={status.message} />
            )}
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle size={16} weight="fill" />
                  <span className="text-sm font-semibold">{t('img.embedComplete')}</span>
                </div>
                <CopyButton text={result.output} labelKey="img.copyPath" />
              </div>
              <ResultMeta
                engine={result.engineUsed ?? engine}
                fallback={result.fallbackUsed}
                confidence={result.confidence}
              />
              <p className="text-xs text-emerald-300/80 text-center mt-3">
                {t('img.qualityResult', { quality: result.quality })}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <ArrowSquareOut size={14} />
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
  neuralModelVersion
}: {
  pyStatus: PyStatus
  python?: string | null
  pyVersion?: string
  pyError?: string
  runnerMode?: 'exe' | 'python' | null
  neuralReady?: boolean
  neuralModelVersion?: string | null
}): ReactElement {
  const { t } = useI18n()
  const [inputPath, setInputPath] = useState('')
  const [pwd, setPwd] = useState(1)
  const [quality, setQuality] = useState<WatermarkQuality>('balanced')
  const [engine, setEngine] = useState<ImageEngine>('auto')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsRecord | undefined>()
  const [engineUsed, setEngineUsed] = useState<string | undefined>()
  const [confidence, setConfidence] = useState<number | undefined>()
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(false)
  const [status, setStatus] = useState<PanelStatus | null>(null)

  useEffect(() => {
    window.api
      .storeGet('imageWm:lastOutputPath')
      .then((value) => {
        if (typeof value === 'string' && value) setInputPath(value)
      })
      .catch(() => undefined)
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
        engine
      })
      if (res.ok && res.wm != null && res.wm !== '') {
        setExtracted(res.wm)
        setDiagnostics(res.diagnostics)
        setEngineUsed(res.engineUsed)
        setFallbackUsed(Boolean(res.fallbackUsed))
        setConfidence(res.confidence)
        setStatus({ kind: 'ok', message: t('img.extractOk') })
      } else {
        setStatus({
          kind: 'error',
          code: res.failureCode ?? (res.ok ? 'wrong_password_or_corrupted_payload' : undefined),
          message: failureText(
            res.failureCode,
            res.userMessage ?? res.error ?? t('img.extractFail'),
            t
          ),
          hints: res.recoveryHints
        })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, pwd, quality, engine, t])

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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,0.9fr)_minmax(420px,1.1fr)] gap-6">
        <div className="flex flex-col gap-4">
          <PathRow
            label={t('img.watermarked')}
            path={inputPath}
            placeholder={t('img.noImage')}
            onBrowse={handleOpenImage}
            icon={<FolderOpen size={15} />}
          />
          {inputPath && <ImagePreview path={inputPath} label={t('img.preview')} />}
        </div>

        <div className="flex flex-col gap-5">
          <StatusBadge kind="warn" message={t('img.extractWarn')} />
          <EngineSelector value={engine} onChange={setEngine} />
          <PwdInput value={pwd} onChange={setPwd} />
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="self-start rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 hover:bg-white/[0.07] cursor-pointer no-drag"
          >
            {showAdvanced ? t('img.hideAdvanced') : t('img.showAdvanced')}
          </button>
          {showAdvanced && (
            <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <QualitySelector value={quality} onChange={setQuality} />
              <HelpText>{t('img.extractAdvancedHelp')}</HelpText>
            </div>
          )}
          <ActionButton
            onClick={handleExtract}
            disabled={!canRun}
            loading={loading}
            icon={<ScanSmiley size={16} weight="regular" />}
            label={loading ? t('img.extracting') : t('img.extract')}
            color="violet"
          />
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div
            key="extract-status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {status.kind === 'error' ? (
              <FailureNotice code={status.code} message={status.message} hints={status.hints} />
            ) : (
              <StatusBadge kind={status.kind} message={status.message} />
            )}
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
            <div className="bg-black/25 rounded-xl border border-emerald-500/20 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-zinc-200">{t('img.extracted')}</span>
                <CopyButton text={extracted} />
              </div>
              <p className="text-lg text-emerald-200 leading-relaxed break-all">{extracted}</p>
            </div>
            <ResultMeta
              engine={engineUsed ?? engine}
              fallback={fallbackUsed}
              confidence={confidence}
            />
            <DiagnosticsList diagnostics={diagnostics} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export type ImageWmSubTab = 'img-embed' | 'img-extract'

export function ImageWatermarkPanel({ activeTab }: { activeTab: ImageWmSubTab }): ReactElement {
  const [pyStatus, setPyStatus] = useState<PyStatus>('checking')
  const [python, setPython] = useState<string | null>(null)
  const [pyVersion, setPyVersion] = useState<string | undefined>()
  const [pyError, setPyError] = useState<string | undefined>()
  const [runnerMode, setRunnerMode] = useState<'exe' | 'python' | null>(null)
  const [neuralReady, setNeuralReady] = useState(false)
  const [neuralModelVersion, setNeuralModelVersion] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .imageWmCheckPython()
      .then((res) => {
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
      })
      .catch((e) => {
        setPyStatus('no-python')
        setPyError(String(e))
      })
  }, [])

  const sharedProps = {
    pyStatus,
    python,
    pyVersion,
    pyError,
    runnerMode,
    neuralReady,
    neuralModelVersion
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col">
      <AnimatePresence mode="wait">
        {activeTab === 'img-embed' && (
          <motion.div
            key="img-embed"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <ImageEmbedPanel {...sharedProps} />
          </motion.div>
        )}
        {activeTab === 'img-extract' && (
          <motion.div
            key="img-extract"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <ImageExtractPanel {...sharedProps} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
