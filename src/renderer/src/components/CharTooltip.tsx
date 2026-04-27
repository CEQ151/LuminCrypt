import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Finding } from '../core/detector'
import { Category, CATEGORY_META } from '../core/categories'
import { X, Copy } from '@phosphor-icons/react'
import { useI18n } from '../i18n'
import type { I18nKey } from '../i18n'

interface CharTooltipProps {
  finding: Finding
  x: number
  y: number
  onClose: () => void
}

const CATEGORY_LABEL_KEYS: Record<Category, I18nKey> = {
  [Category.ZERO_WIDTH]: 'category.zeroWidth',
  [Category.CONTROL_BIDI]: 'category.bidi',
  [Category.SPECIAL_SPACE]: 'category.specialSpace',
  [Category.TAGS_BLOCK]: 'category.tagsBlock',
  [Category.HOMOGLYPH]: 'category.homoglyph',
  [Category.VARIATION_SELECTOR]: 'category.variation',
  [Category.TYPO_PUNCT]: 'category.typoPunct',
}

export default function CharTooltip({ finding, x, y, onClose }: CharTooltipProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const meta = CATEGORY_META[finding.category]
  const codePointStr = `U+${finding.codePoint.toString(16).toUpperCase().padStart(4, '0')}`

  // Close on outside click — skip if user clicked another char trigger
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('[data-char-trigger]')) return
      if (ref.current && !ref.current.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Copy codepoint to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(codePointStr).catch(() => {})
  }

  // Clamp position to viewport
  const clampedX = Math.min(x, window.innerWidth - 280)
  const clampedY = Math.min(y, window.innerHeight - 180)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      style={{ left: clampedX, top: clampedY, transform: 'translateX(-50%)' }}
      className="fixed z-50 w-64 rounded-2xl p-4"
    >
      {/* Opaque backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: 'rgba(12, 12, 20, 0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          pointerEvents: 'none',
        }}
      />
      {/* Content sits above backdrop */}
      <div className="relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${meta.textColor}`}>
            {t(CATEGORY_LABEL_KEYS[finding.category])}
          </span>
          <p className="text-xs font-medium text-zinc-200 mt-0.5 leading-snug">
            {finding.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-200 transition-colors flex-shrink-0 cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Codepoint */}
      <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 mb-3">
        <span className="font-mono text-sm text-cyan-400 font-semibold">{codePointStr}</span>
        <button
          onClick={copyCode}
          className="text-zinc-600 hover:text-zinc-200 transition-colors cursor-pointer"
          title={t('tooltip.copyCode')}
        >
          <Copy size={12} />
        </button>
      </div>

      {/* Details */}
      <p className="text-xs text-zinc-300 leading-relaxed mb-3">{finding.description}</p>

      {finding.latinEquivalent && (
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="text-zinc-600">{t('tooltip.looksLike')}</span>
          <span className="font-mono text-white bg-white/5 px-1.5 py-0.5 rounded">
            {finding.latinEquivalent}
          </span>
          {finding.script && (
            <span className="text-zinc-600">({finding.script})</span>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[10px] text-zinc-600">
          <span>{t('tooltip.position')}</span>
          <span className="font-mono text-zinc-300">{finding.index.toLocaleString()}</span>
        </div>
      </div>
      </div>
    </motion.div>
  )
}
