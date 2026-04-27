import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Export, FilePdf, FileJs, FileCsv, CaretDown } from '@phosphor-icons/react'
import { ScanResult } from '../core/detector'
import { CATEGORY_META } from '../core/categories'
import { generateCSV } from '../core/csvExport'
import { useI18n } from '../i18n'

interface ExportMenuProps {
  result: ScanResult
  originalText?: string
}

export default function ExportMenu({ result }: ExportMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function exportJSON() {
    setExporting(true)
    setOpen(false)
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        riskScore: result.riskScore,
        totalChars: result.totalChars,
        suspiciousCount: result.suspiciousCount,
        scanDurationMs: result.scanDurationMs,
        findings: result.findings.map((f) => ({
          position: f.index,
          codePoint: `U+${f.codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
          category: f.category,
          label: f.label,
          description: f.description,
          latinEquivalent: f.latinEquivalent,
          script: f.script,
        })),
        categoryBreakdown: Object.fromEntries(
          Array.from(result.stats.entries()).map(([cat, stat]) => [
            cat,
            { count: stat.count, label: CATEGORY_META[cat].label },
          ])
        ),
      }
      const json = JSON.stringify(exportData, null, 2)
      const res = await window.api.saveFile(json, 'json', `unicode-scan-${Date.now()}.json`)
      if (!res.success && res.error !== 'Canceled') {
        console.error('Export failed:', res.error)
      }
    } finally {
      setExporting(false)
    }
  }

  async function exportCSV() {
    setExporting(true)
    setOpen(false)
    try {
      const csv = generateCSV(result)
      const res = await window.api.saveCSV(csv, `unicode-scan-${Date.now()}.csv`)
      if (!res.success && res.error !== 'Canceled') {
        console.error('CSV export failed:', res.error)
      }
    } finally {
      setExporting(false)
    }
  }

  async function exportPDF() {
    setExporting(true)
    setOpen(false)
    try {
      const html = buildPDFHtml(result)
      const b64 = btoa(unescape(encodeURIComponent(html)))
      const res = await window.api.exportPDF(b64, `unicode-scan-${Date.now()}.pdf`)
      if (!res.success && res.error !== 'Canceled') {
        console.error('PDF export failed:', res.error)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative no-drag">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={exporting}
        className="
          flex items-center gap-2 text-xs font-medium text-zinc-200 hover:text-white
          bg-white/[0.03] hover:bg-white/[0.07]
          border border-white/[0.08] hover:border-white/[0.16]
          px-3 py-1.5 rounded-lg
          transition-colors duration-150 cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        <Export size={13} />
        <span>{exporting ? t('export.exporting') : t('export.button')}</span>
        <CaretDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="
                absolute right-0 top-full mt-1.5 z-40
                w-52 overflow-hidden desktop-menu
              "
            >
              <MenuItem icon={<FileJs size={14} className="text-emerald-400" />} onClick={exportJSON} label={t('export.json')} sub={t('export.jsonSub')} />
              <div className="h-px bg-white/[0.05]" />
              <MenuItem icon={<FileCsv size={14} className="text-sky-400" />} onClick={exportCSV} label={t('export.csv')} sub={t('export.csvSub')} />
              <div className="h-px bg-white/[0.05]" />
              <MenuItem icon={<FilePdf size={14} className="text-red-400" />} onClick={exportPDF} label={t('export.pdf')} sub={t('export.pdfSub')} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="
        flex items-center gap-2.5 w-full px-3.5 py-2.5 desktop-menu-item
        text-xs text-white hover:text-white
        hover:bg-white/[0.1]
        transition-colors duration-120 cursor-pointer
      "
    >
      {icon}
      <div className="text-left">
        <p className="font-medium leading-tight">{label}</p>
        <p className="text-zinc-500 text-[10px] leading-tight mt-0.5">{sub}</p>
      </div>
    </button>
  )
}

function buildPDFHtml(result: ScanResult): string {
  const now = new Date().toLocaleString('zh-CN')
  const riskColor = result.riskScore >= 65 ? '#ef4444' : result.riskScore >= 30 ? '#f59e0b' : '#10b981'

  const categoryRows = Array.from(result.stats.entries())
    .map(([cat, stat]) => `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;">${CATEGORY_META[cat].label}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${stat.count}</td>
      </tr>
    `).join('')

  const findingRows = result.findings.slice(0, 500).map((f, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
      <td style="padding:4px 6px;font-size:11px;">${i + 1}</td>
      <td style="padding:4px 6px;font-size:11px;">${f.index}</td>
      <td style="padding:4px 6px;font-size:11px;font-family:monospace;">U+${f.codePoint.toString(16).toUpperCase().padStart(4, '0')}</td>
      <td style="padding:4px 6px;font-size:11px;">${CATEGORY_META[f.category].label}</td>
      <td style="padding:4px 6px;font-size:11px;">${f.label}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Unicode Detector \u626b\u63cf\u62a5\u544a</title>
  <style>
    body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #111; margin: 40px; font-size: 13px; line-height: 1.6; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #111; }
    h2 { font-size: 14px; font-weight: 600; margin: 24px 0 8px; color: #333; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
    th { text-align: left; font-size: 11px; color: #6b7280; padding: 6px 8px; background: #f3f4f6; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .score { font-size: 32px; font-weight: 700; color: ${riskColor}; }
  </style>
</head>
<body>
  <h1>Unicode Detector \u2014 \u626b\u63cf\u62a5\u544a</h1>
  <p class="meta">\u751f\u6210\u65f6\u95f4\uff1a${now}</p>

  <h2>\u6458\u8981</h2>
  <table>
    <tr><th>\u98ce\u9669\u5206\u6570</th><td><span class="score">${result.riskScore}</span> / 100</td></tr>
    <tr><th>\u603b\u5b57\u7b26\u6570</th><td>${result.totalChars.toLocaleString('zh-CN')}</td></tr>
    <tr><th>\u53ef\u7591\u5b57\u7b26</th><td>${result.suspiciousCount.toLocaleString('zh-CN')}</td></tr>
    <tr><th>\u626b\u63cf\u8017\u65f6</th><td>${result.scanDurationMs.toFixed(2)} ms</td></tr>
  </table>

  <h2>\u7c7b\u522b\u5206\u5e03</h2>
  <table>
    <thead><tr><th>\u7c7b\u522b</th><th style="text-align:right;">\u6570\u91cf</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>\u53ef\u7591\u5b57\u7b26\u660e\u7ec6${result.findings.length > 500 ? `\uff08\u524d 500 \u6761\uff0c\u5171 ${result.findings.length} \u6761\uff09` : ''}</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>\u4f4d\u7f6e</th><th>\u7801\u70b9</th><th>\u7c7b\u522b</th><th>\u6807\u7b7e</th>
      </tr>
    </thead>
    <tbody>${findingRows}</tbody>
  </table>
</body>
</html>`
}
