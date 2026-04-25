import { ScanResult } from '../core/detector'
import { CATEGORY_META } from '../core/categories'

/** Escapes a CSV field, quoting if it contains commas, quotes, or newlines */
function csvField(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const HEADERS = ['#', '位置', '码点', '类别', '标签', '描述', '对应字符']

export function generateCSV(result: ScanResult): string {
  const rows: string[] = [
    // UTF-8 BOM prepended by IPC handler; just write the data
    '# Unicode Detector — 扫描报告',
    `# 导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `# 风险分数: ${result.riskScore} / 100`,
    `# 总字符数: ${result.totalChars}`,
    `# 可疑字符: ${result.suspiciousCount}`,
    `# 扫描耗时: ${result.scanDurationMs.toFixed(2)} ms`,
    '',
    HEADERS.join(','),
  ]

  result.findings.forEach((f, i) => {
    const row = [
      csvField(i + 1),
      csvField(f.index),
      csvField(`U+${f.codePoint.toString(16).toUpperCase().padStart(4, '0')}`),
      csvField(CATEGORY_META[f.category].label),
      csvField(f.label),
      csvField(f.description),
      csvField(f.latinEquivalent ?? ''),
    ]
    rows.push(row.join(','))
  })

  return rows.join('\r\n')
}
