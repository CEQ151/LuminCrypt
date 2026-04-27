import { ArrowCounterClockwise, Info } from '@phosphor-icons/react'
import { useSettings } from '../contexts/SettingsContext'
import { Category, CATEGORY_META } from '../core/categories'
import { LanguageSetting, useI18n } from '../i18n'
import type { I18nKey } from '../i18n'

const CATEGORY_ORDER = [
  Category.TAGS_BLOCK,
  Category.ZERO_WIDTH,
  Category.CONTROL_BIDI,
  Category.VARIATION_SELECTOR,
  Category.HOMOGLYPH,
  Category.SPECIAL_SPACE,
  Category.TYPO_PUNCT,
] as const

const CATEGORY_LABEL_KEYS: Record<Category, { label: I18nKey; desc: I18nKey }> = {
  [Category.ZERO_WIDTH]: { label: 'category.zeroWidth', desc: 'category.zeroWidthDesc' },
  [Category.CONTROL_BIDI]: { label: 'category.bidi', desc: 'category.bidiDesc' },
  [Category.SPECIAL_SPACE]: { label: 'category.specialSpace', desc: 'category.specialSpaceDesc' },
  [Category.TAGS_BLOCK]: { label: 'category.tagsBlock', desc: 'category.tagsBlockDesc' },
  [Category.HOMOGLYPH]: { label: 'category.homoglyph', desc: 'category.homoglyphDesc' },
  [Category.VARIATION_SELECTOR]: { label: 'category.variation', desc: 'category.variationDesc' },
  [Category.TYPO_PUNCT]: { label: 'category.typoPunct', desc: 'category.typoPunctDesc' },
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { t, languageSetting, setLanguage } = useI18n()

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
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl text-zinc-100 leading-none font-display">
              {t('settings.title')}
            </h1>
            <p className="text-sm text-zinc-400 mt-2">{t('settings.subtitle')}</p>
          </div>
          <button
            onClick={resetSettings}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer no-drag"
          >
            <ArrowCounterClockwise size={14} weight="regular" />
            {t('settings.reset')}
          </button>
        </div>

        <section className="mb-8">
          <SectionHeader title={t('settings.language.title')} subtitle={t('settings.language.subtitle')} />
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-2">
            {([
              ['system', t('settings.language.system')],
              ['zh-CN', t('settings.language.zh')],
              ['en', t('settings.language.en')],
            ] as Array<[LanguageSetting, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLanguage(value)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer no-drag ${
                  languageSetting === value
                    ? 'bg-white/[0.12] text-white border border-white/[0.16]'
                    : 'text-zinc-300 border border-transparent hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader title={t('settings.rules.title')} subtitle={t('settings.rules.subtitle')} />
          <div className="space-y-1 mt-3">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat]
              const categoryText = CATEGORY_LABEL_KEYS[cat]
              const enabled = settings.enabledCategories[cat] ?? true
              return (
                <label
                  key={cat}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-black/25 border border-white/[0.06] hover:border-white/[0.1] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
                    <div>
                      <p className={`text-sm font-medium transition-colors ${enabled ? 'text-zinc-100' : 'text-zinc-500'}`}>
                        {t(categoryText.label)}
                      </p>
                      <p className="text-xs text-zinc-400">{t(categoryText.desc)}</p>
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

        <section className="mb-8">
          <SectionHeader title={t('settings.threshold.title')} subtitle={t('settings.threshold.subtitle')} />
          <div className="mt-3 bg-black/25 rounded-xl border border-white/[0.06] p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-200">{t('settings.threshold.lowMid')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-500">{t('settings.threshold.low')}</span>
                  <span className="text-xs text-zinc-500">≤</span>
                  <input
                    type="number"
                    value={settings.thresholds.lowMid}
                    min={1}
                    max={settings.thresholds.midHigh - 1}
                    onChange={(e) => handleThreshold('lowMid', e.target.value)}
                    className="w-16 bg-white/[0.06] border border-white/[0.1] text-zinc-100 text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-[#3b7cd4]/50 no-drag"
                  />
                </div>
              </div>
              <RangeBar value={settings.thresholds.lowMid} color="#10b981" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-200">{t('settings.threshold.midHigh')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-500">{t('settings.threshold.mid')}</span>
                  <span className="text-xs text-zinc-500">≤</span>
                  <input
                    type="number"
                    value={settings.thresholds.midHigh}
                    min={settings.thresholds.lowMid + 1}
                    max={99}
                    onChange={(e) => handleThreshold('midHigh', e.target.value)}
                    className="w-16 bg-white/[0.06] border border-white/[0.1] text-zinc-100 text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-[#3b7cd4]/50 no-drag"
                  />
                </div>
              </div>
              <RangeBar value={settings.thresholds.midHigh} color="#f59e0b" />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.03] rounded-lg px-3 py-2">
              <Info size={12} />
              {t('settings.threshold.summary', {
                low: settings.thresholds.lowMid,
                lowPlus: settings.thresholds.lowMid + 1,
                mid: settings.thresholds.midHigh,
                midPlus: settings.thresholds.midHigh + 1,
              })}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader title={t('settings.clipboard.title')} subtitle={t('settings.clipboard.subtitle')} />
          <div className="mt-3 bg-black/25 rounded-xl border border-white/[0.06] p-5 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white font-medium">{t('settings.clipboard.enable')}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{t('settings.clipboard.desc')}</p>
              </div>
              <Toggle
                checked={settings.clipboardEnabled}
                onChange={() => updateSettings('clipboardEnabled', !settings.clipboardEnabled)}
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-200">{t('settings.clipboard.interval')}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.clipboardIntervalMs}
                  min={500}
                  max={10000}
                  step={100}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  disabled={!settings.clipboardEnabled}
                  className="w-20 bg-white/[0.06] border border-white/[0.1] text-zinc-100 text-sm text-center rounded-lg px-2 py-1 focus:outline-none focus:border-[#3b7cd4]/50 disabled:opacity-40 no-drag"
                />
                <span className="text-xs text-zinc-400">ms</span>
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
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
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
