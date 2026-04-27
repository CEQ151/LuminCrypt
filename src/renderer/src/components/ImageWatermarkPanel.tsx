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
import { I18nKey, useI18n } from '../i18n'

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

function CopyButton({ text, labelKey = 'common.copy' }: { text: string; labelKey?: I18nKey }) {
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

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold text-zinc-200">{children}</span>
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-zinc-400 leading-relaxed px-0.5">{children}</span>
}

function StatusBadge({ kind, message }: PanelStatus) {
  const styles = {
    ok: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
    error: 'bg-red-500/10 border-red-500/25 text-red-200',
    warn: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
  }
  const Icon = kind === 'ok' ? CheckCircle : kind === 'warn' ? Warning : WarningCircle
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed border ${styles[kind]}`}>
      <Icon size={16} weight="regular" className="flex-shrink-0 mt-0.5" />
      <span className="whitespace-pre-wrap break-words">{message}</span>
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
  icon,
}: {
  label: string
  path: string
  placeholder: string
  onBrowse: () => void
  icon: React.ReactNode
}) {
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

function ImagePreview({ path, label }: { path: string; label: string }) {
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
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
    </div>
  )
}

function PwdInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

function EngineSelector({ value, onChange }: { value: ImageEngine; onChange: (engine: ImageEngine) => void }) {
  const { t } = useI18n()
  const options: Array<{ id: ImageEngine; label: string; desc: string }> = [
    { id: 'auto', label: t('img.engine.auto'), desc: t('img.engine.autoDesc') },
    { id: 'legacy', label: t('img.engine.legacy'), desc: t('img.engine.legacyDesc') },
    { id: 'neural', label: t('img.engine.neural'), desc: t('img.engine.neuralDesc') },
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

function QualitySelector({ value, onChange }: { value: WatermarkQuality; onChange: (v: WatermarkQuality) => void }) {
  const { t } = useI18n()
  const presets: Array<{ id: WatermarkQuality; label: string; desc: string; hint: string; color: string }> = [
    { id: 'invisible', label: t('img.quality.invisible'), desc: t('img.quality.invisibleDesc'), hint: t('img.quality.invisibleHint'), color: 'text-sky-200' },
    { id: 'balanced', label: t('img.quality.balanced'), desc: t('img.quality.balancedDesc'), hint: t('img.quality.balancedHint'), color: 'text-emerald-300' },
    { id: 'robust', label: t('img.quality.robust'), desc: t('img.quality.robustDesc'), hint: t('img.quality.robustHint'), color: 'text-amber-300' },
  ]
  const current = presets.find((preset) => preset.id === value)!

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.quality')}</Label>
      <div className="grid grid-cols-3 gap-2 bg-black/25 rounded-xl border border-white/[0.08] p-2">
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
            <span className={`text-sm font-semibold ${value === preset.id ? preset.color : 'text-zinc-300'}`}>{preset.label}</span>
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
    const runnerText = runnerMode === 'exe' ? t('img.backend.exeReady') : t('img.backend.pythonReady', { python: python ?? 'unknown' })
    const neuralText = neuralReady
      ? t('img.backend.neuralReady', { version: neuralModelVersion ? ` · ${neuralModelVersion}` : '' })
      : t('img.backend.neuralMissing')
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-emerald-300 py-0.5">
          <CheckCircle size={15} weight="fill" />
          {runnerText}{version ? ` · engine v${version}` : ''}
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

function DiagnosticsList({ diagnostics }: { diagnostics?: DiagnosticsRecord }) {
  const { t } = useI18n()
  if (!diagnostics || Object.keys(diagnostics).length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Label>{t('img.diagnostics')}</Label>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(diagnostics).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3">
            <div className="text-xs font-medium text-zinc-300">{key}</div>
            <div className="text-xs text-zinc-400 break-all mt-1.5">{typeof value === 'string' ? value : JSON.stringify(value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function normalizeExtractError(message: string, fallback: string) {
  const lower = message.toLowerCase()
  if (lower.includes('no valid watermark found') || lower.includes('chien search') || lower.includes('crc')) {
    return fallback
  }
  return message
}

function ResultMeta({
  engine,
  fallback,
  confidence,
}: {
  engine: string
  fallback?: boolean
  confidence?: number
}) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-zinc-200">
      {t('img.engineResult', { engine })}
      <span className="text-zinc-400">
        {' · '}
        {fallback ? t('img.fallbackUsed') : t('img.directSuccess')}
        {typeof confidence === 'number' && ` · ${t('img.confidence', { value: Math.round(confidence * 100) })}`}
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
  const { t } = useI18n()
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
        const engineInfo = res.fallbackUsed ? `${res.engineUsed ?? 'legacy'} · ${t('img.fallbackUsed')}` : `${res.engineUsed ?? engine} · ${t('img.directSuccess')}`
        setStatus({ kind: 'ok', message: t('img.embedOk', { engineInfo }) })
      } else {
        setStatus({ kind: 'error', message: res.error ?? t('img.embedFail') })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) })
    } finally {
      setLoading(false)
    }
  }, [inputPath, outputPath, wmText, pwd, quality, engine, t])

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
                {!shortPayloadEligible && <span className="text-amber-300"> · {t('img.neuralLimitInline')}</span>}
              </HelpText>
            )}
          </div>

          <EngineSelector value={engine} onChange={setEngine} />
          <PwdInput value={pwd} onChange={setPwd} />
          <QualitySelector value={quality} onChange={setQuality} />

          <PathRow
            label={t('img.output')}
            path={outputPath}
            placeholder={t('img.noOutput')}
            onBrowse={handleSaveDst}
            icon={<FloppyDisk size={15} />}
          />

          {engine === 'neural' && !shortPayloadEligible && (
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
  const { t } = useI18n()
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
        setStatus({ kind: 'ok', message: t('img.extractOk') })
      } else {
        setStatus({ kind: 'error', message: normalizeExtractError(res.error ?? t('img.extractFail'), t('img.noWatermark')) })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: normalizeExtractError(String(e), t('img.noWatermark')) })
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
          <QualitySelector value={quality} onChange={setQuality} />
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
