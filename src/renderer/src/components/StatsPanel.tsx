import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ScanResult } from '../core/detector'
import { Category, CATEGORY_META } from '../core/categories'
import { ShieldCheck, ShieldWarning, ShieldSlash } from '@phosphor-icons/react'

interface StatsPanelProps {
  result: ScanResult
}

function RiskGauge({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDash = (score / 100) * circumference
  const color = score < 30 ? '#22d3ee' : score < 65 ? '#f59e0b' : '#ef4444'
  const label = score < 30 ? '低风险' : score < 65 ? '中等风险' : '高风险'
  const Icon = score < 30 ? ShieldCheck : score < 65 ? ShieldWarning : ShieldSlash

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="6"
          />
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - strokeDash }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">/100</span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Icon size={15} weight="fill" style={{ color }} />
          <span className="text-sm font-semibold" style={{ color }}>
            {label}
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed max-w-[160px]">
          {score === 0
            ? '未发现可疑字符。'
            : score < 30
            ? '存在少量异常，可能属于正常使用。'
            : score < 65
            ? '发现多处可疑字符模式。'
            : '强烈提示存在隐藏水印。'}
        </p>
      </div>
    </div>
  )
}

function ActionBadge({ score }: { score: number }) {
  const cfg =
    score < 30
      ? { text: '可忽略', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)' }
      : score < 65
      ? { text: '建议清理', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' }
      : { text: '建议重写', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-300">建议操作</span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {cfg.text}
      </span>
    </div>
  )
}

const CATEGORY_ORDER = [
  Category.TAGS_BLOCK,
  Category.ZERO_WIDTH,
  Category.VARIATION_SELECTOR,
  Category.CONTROL_BIDI,
  Category.HOMOGLYPH,
  Category.SPECIAL_SPACE,
  Category.TYPO_PUNCT,
] as const

export default function StatsPanel({ result }: StatsPanelProps) {
  const activeCategories = useMemo(
    () => CATEGORY_ORDER.filter((c) => result.stats.has(c)),
    [result]
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Risk Score */}
      <div className="desktop-panel p-4">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-base text-white leading-none font-display tracking-[0.02em]">
            风险评估
          </span>
          <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">Risk</span>
        </div>
        <RiskGauge score={result.riskScore} />
        {result.riskScore > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <ActionBadge score={result.riskScore} />
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { label: '字符总数', value: result.totalChars.toLocaleString() },
            { label: '可疑字符', value: result.suspiciousCount.toLocaleString() },
            { label: '扫描耗时', value: `${result.scanDurationMs.toFixed(1)}ms` },
          ]
        ).map(({ label, value }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.4 }}
            className="desktop-panel-soft p-3 text-center"
          >
            <p className="font-mono text-base font-semibold text-cyan-200 tabular-nums">{value}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5 tracking-wider">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Per-category breakdown */}
      {activeCategories.length > 0 && (
        <div className="desktop-panel overflow-hidden">
          <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-2">
            <span className="text-base text-white leading-none font-display tracking-[0.02em]">
              分类明细
            </span>
            <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">By Category</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {activeCategories.map((cat, i) => {
              const catStat = result.stats.get(cat)!
              const meta = CATEGORY_META[cat]
              const pct = Math.round((catStat.count / result.suspiciousCount) * 100)

              return (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.textColor} opacity-80`}
                    style={{ background: meta.glowColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-200">{meta.label}</span>
                      <span className="font-mono text-xs font-semibold text-white tabular-nums ml-2">
                        {catStat.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-0.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: meta.glowColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeCategories.length === 0 && result.suspiciousCount === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ShieldCheck size={28} weight="thin" className="text-cyan-400/40" />
          <p className="text-xs text-zinc-600">No suspicious characters found</p>
        </div>
      )}
    </div>
  )
}
