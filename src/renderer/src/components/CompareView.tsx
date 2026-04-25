import { ScanResult } from '../core/detector'
import HighlightView from './HighlightView'

interface CompareViewProps {
  originalText: string
  cleanedText: string
  result: ScanResult
}

export default function CompareView({ originalText, cleanedText, result }: CompareViewProps) {
  return (
    <div className="h-full grid grid-cols-2 gap-3">
      {/* Original with highlights */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">原文</span>
          <span className="text-[10px] text-zinc-700 font-mono tabular-nums">
            {result.suspiciousCount} 处可疑
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <HighlightView text={originalText} result={result} />
        </div>
      </div>

      {/* Cleaned text */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest">净化后</span>
          <span className="text-[10px] text-zinc-700 font-mono tabular-nums">
            已移除 {result.suspiciousCount} 处
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
