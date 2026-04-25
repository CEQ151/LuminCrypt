import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Finding, ScanResult } from '../core/detector'
import { Category, CATEGORY_META } from '../core/categories'
import CharTooltip from './CharTooltip'

interface HighlightViewProps {
  text: string
  result: ScanResult
}

export default function HighlightView({ text, result }: HighlightViewProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Build a fast lookup: char index → Finding
  const findingByIndex = useMemo(() => {
    const map = new Map<number, Finding>()
    for (const f of result.findings) map.set(f.index, f)
    return map
  }, [result.findings])

  // Build segments: consecutive clean chars → one span, each suspicious char → its own span
  const segments = useMemo(() => {
    const chars = Array.from(text)
    const segs: Array<{ text: string; finding: Finding | null; startIndex: number }> = []
    let cleanBuffer = ''
    let cleanStart = 0
    for (let i = 0; i < chars.length; i++) {
      const finding = findingByIndex.get(i)
      if (finding) {
        if (cleanBuffer) {
          segs.push({ text: cleanBuffer, finding: null, startIndex: cleanStart })
          cleanBuffer = ''
        }
        segs.push({ text: chars[i], finding, startIndex: i })
      } else {
        if (!cleanBuffer) cleanStart = i
        cleanBuffer += chars[i]
      }
    }
    if (cleanBuffer) segs.push({ text: cleanBuffer, finding: null, startIndex: cleanStart })
    return segs
  }, [text, findingByIndex])

  const handleClick = useCallback((e: React.MouseEvent<HTMLSpanElement>, finding: Finding) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })
    setActiveFinding(finding)
    setActiveIndex(finding.index)
  }, [])


  return (
    <>
      <div
        className="
          relative w-full h-full overflow-y-auto
          bg-black/30 rounded-xl
          border border-white/[0.06]
          px-4 py-3.5
          text-sm text-white leading-relaxed
          font-mono
          whitespace-pre-wrap break-all
        "
      >
        {segments.map((seg, si) => {
          if (!seg.finding) {
            return (
              <span key={si} className="text-white">
                {seg.text}
              </span>
            )
          }

          const meta = CATEGORY_META[seg.finding.category]
          const isActive = activeIndex === seg.startIndex
          // Homoglyphs are visible characters; everything else (zero-width, BiDi, special space, Tags Block) is invisible
          const isInvisible = seg.finding.category !== Category.HOMOGLYPH

          return (
            <motion.span
              key={si}
              data-char-trigger
              onClick={(e) => handleClick(e, seg.finding!)}
              className={`
                inline-block cursor-pointer select-none
                rounded px-0.5 mx-[0.5px] relative
                ${meta.color} ${meta.textColor}
                border ${meta.borderColor}
                transition-all duration-150
                hover:brightness-125
                ${isActive ? 'brightness-150 scale-105' : ''}
              `}
              style={{
                boxShadow: isActive ? `0 0 12px ${meta.glowColor}, 0 0 4px ${meta.glowColor}` : undefined,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {isInvisible ? (
                <span
                  className="inline-block font-mono text-[9px] leading-none align-middle opacity-80 tracking-tighter"
                  title={`U+${seg.finding.codePoint.toString(16).toUpperCase().padStart(4, '0')}`}
                >
                  {`U+${seg.finding.codePoint.toString(16).toUpperCase().padStart(4, '0')}`}
                </span>
              ) : (
                seg.text
              )}
            </motion.span>
          )
        })}
      </div>

      {/* Tooltip */}
      <AnimatePresence initial={false}>
        {activeFinding && (
          <CharTooltip
            finding={activeFinding}
            x={tooltipPos.x}
            y={tooltipPos.y}
            onClose={() => { setActiveFinding(null); setActiveIndex(null) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
