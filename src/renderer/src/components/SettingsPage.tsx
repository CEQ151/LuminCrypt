import { ArrowCounterClockwise, Info } from '@phosphor-icons/react'
import { useSettings } from '../contexts/SettingsContext'
import { Category, CATEGORY_META } from '../core/categories'

const CATEGORY_ORDER = [
  Category.TAGS_BLOCK,
  Category.ZERO_WIDTH,
  Category.CONTROL_BIDI,
  Category.VARIATION_SELECTOR,
  Category.HOMOGLYPH,
  Category.SPECIAL_SPACE,
  Category.TYPO_PUNCT,
] as const

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()

  const handleThreshold = (key: 'lowMid' | 'midHigh', raw: string) => {
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0 || n > 100) return
    updateSettings('thresholds', { ...settings.thresholds, [key]: n })
  }

  const handleIntervalChange = (raw: string) => {
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 500) return
    updateSettings('clipboardIntervalMs', n)
  }

  const toggleCategory = (cat: Category) => {
    updateSettings('enabledCategories', {
      ...settings.enabledCategories,
      [cat]: !settings.enabledCategories[cat],
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-base text-zinc-200 leading-none font-display tracking-[0.02em]">
              设置
            </h1>
            <p className="text-xs text-zinc-600 mt-1">自定义检测规则和行为偏好</p>
          </div>
          <button
            onClick={resetSettings}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-200 transition-colors cursor-pointer no-drag"
          >
            <ArrowCounterClockwise size={12} weight="regular" />
            恢复默认
          </button>
        </div>

        {/* Detection Rules */}
        <section className="mb-8">
          <SectionHeader title="检测规则" subtitle="控制哪些字符类别参与扫描" />
          <div className="space-y-1 mt-3">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat]
              const enabled = settings.enabledCategories[cat] ?? true
              return (
                <label
                  key={cat}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-black/25 border border-white/[0.06] hover:border-white/[0.1] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
                    <div>
                      <p className={`text-sm font-medium transition-colors ${enabled ? 'text-zinc-200' : 'text-zinc-600'}`}>
                        {meta.label}
                      </p>
                      <p className="text-xs text-zinc-600">{meta.description}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={enabled}
                    onChange={() => toggleCategory(cat)}
                  />
                </label>
              )
            })}
          </div>
        </section>

        {/* Risk Thresholds */}
        <section className="mb-8">
          <SectionHeader title="风险阈值" subtitle="调整风险评级的分数分界线" />
          <div className="mt-3 bg-black/25 rounded-xl border border-white/[0.06] p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-200">低 / 中 分界</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-500">低风险</span>
                  <span className="text-xs text-zinc-600">≤</span>
                  <input
                    type="number"
                    value={settings.thresholds.lowMid}
                    min={1}
                    max={settings.thresholds.midHigh - 1}
                    onChange={(e) => handleThreshold('lowMid', e.target.value)}
                    className="w-16 bg-white/[0.06] border border-white/[0.1] text-zinc-200 text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-[#3b7cd4]/50 no-drag"
                  />
                </div>
              </div>
              <RangeBar value={settings.thresholds.lowMid} color="#10b981" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-200">中 / 高 分界</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-500">中风险</span>
                  <span className="text-xs text-zinc-600">≤</span>
                  <input
                    type="number"
                    value={settings.thresholds.midHigh}
                    min={settings.thresholds.lowMid + 1}
                    max={99}
                    onChange={(e) => handleThreshold('midHigh', e.target.value)}
                    className="w-16 bg-white/[0.06] border border-white/[0.1] text-zinc-200 text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-[#3b7cd4]/50 no-drag"
                  />
                </div>
              </div>
              <RangeBar value={settings.thresholds.midHigh} color="#f59e0b" />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 bg-white/[0.03] rounded-lg px-3 py-2">
              <Info size={12} />
              当前阈值：0–{settings.thresholds.lowMid} 低风险 · {settings.thresholds.lowMid + 1}–{settings.thresholds.midHigh} 中等风险 · {settings.thresholds.midHigh + 1}–100 高风险
            </div>
          </div>
        </section>

        {/* Clipboard Monitoring */}
        <section className="mb-8">
          <SectionHeader title="剪贴板监听" subtitle="自动检测剪贴板变化并提示扫描" />
          <div className="mt-3 bg-black/25 rounded-xl border border-white/[0.06] p-5 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white font-medium">启用监听</p>
                <p className="text-xs text-zinc-600 mt-0.5">复制新文本时显示提示，可快速跳转扫描</p>
              </div>
              <Toggle
                checked={settings.clipboardEnabled}
                onChange={() => updateSettings('clipboardEnabled', !settings.clipboardEnabled)}
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-200">检测间隔</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.clipboardIntervalMs}
                  min={500}
                  max={10000}
                  step={100}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  disabled={!settings.clipboardEnabled}
                  className="w-20 bg-white/[0.06] border border-white/[0.1] text-zinc-200 text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-[#3b7cd4]/50 disabled:opacity-40 no-drag"
                />
                <span className="text-xs text-zinc-600">ms</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
      <p className="text-xs text-zinc-600 mt-0.5">{subtitle}</p>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${checked ? 'bg-[#3b7cd4]' : 'bg-white/[0.1]'}`}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-[transform] duration-200"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

function RangeBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  )
}
