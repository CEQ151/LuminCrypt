import { ScanResult } from '../core/detector'
import HighlightView from './HighlightView'
import { useI18n } from '../i18n'

interface CompareViewProps {
  originalText: string
  cleanedText: string
  result: ScanResult
}

export default function CompareView({ originalText, cleanedText, result }: CompareViewProps) {
  const { t } = useI18n()
  return (
    <div className="h-full grid grid-cols-2 gap-3">
      {/* Original with highlights */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <span className="text-xs font-semibold text-zinc-300">{t('detect.original')}</span>
          <span className="text-[10px] text-zinc-700 font-mono tabular-nums">
            {t('detect.suspiciousCount', { count: result.suspiciousCount })}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <HighlightView text={originalText} result={result} />
        </div>
      </div>

      {/* Cleaned text */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <span className="text-xs font-semibold text-emerald-300">{t('detect.cleanAfter')}</span>
          <span className="text-[10px] text-zinc-700 font-mono tabular-nums">
            {t('detect.removedCount', { count: result.suspiciousCount })}
          </span>
        </div>
        <textarea
          value={cleanedText}
          readOnly
          className="flex-1 bg-black/25 rounded-xl border border-emerald-500/20 text-sm text-white leading-relaxed font-['Geist_Mono',monospace] resize-none px-4 py-3.5 focus:outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
