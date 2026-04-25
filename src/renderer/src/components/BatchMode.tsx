import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadSimple,
  Trash,
  Broom,
  Play,
  X,
  CheckCircle,
  WarningCircle,
  FileText,
  TextT,
  CheckSquare,
  Square,
  MinusSquare,
} from '@phosphor-icons/react'
import { BatchItem, useBatch } from '../hooks/useBatch'
import StatsPanel from './StatsPanel'

type BatchHook = ReturnType<typeof useBatch>

export default function BatchMode({ batchHook }: { batchHook: BatchHook }) {
  const {
    items,
    scanning,
    addFiles,
    addSegments,
    toggleSelect,
    toggleSelectAll,
    scanSelected,
    scanAll,
    cleanItem,
    cleanAllItems,
    removeItem,
    clearAll,
  } = batchHook

  const [segmentText, setSegmentText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length) addFiles(files)
    },
    [addFiles]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    e.target.value = ''
  }

  const handleAddSegments = () => {
    if (!segmentText.trim()) return
    addSegments(segmentText)
    setSegmentText('')
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const selectedCount = items.filter((i) => i.selected).length
  const totalRisk = items.reduce((sum, i) => sum + (i.result?.riskScore ?? 0), 0)
  const avgRisk = doneCount > 0 ? Math.round(totalRisk / doneCount) : 0
  const allSelected = items.length > 0 && items.every((i) => i.selected)
  const someSelected = selectedCount > 0 && selectedCount < items.length
  const canScan = !scanning && items.some((i) => i.selected && i.originalText)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <h1 className="text-base text-white leading-none font-display tracking-[0.02em]">
            批量检测
          </h1>
          <p className="text-xs text-zinc-300 mt-1">同时检测多个文件或多段文本</p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {doneCount > 0 && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.07]">
                <span className="text-xs text-zinc-200">
                  <span className="text-white font-mono font-semibold">{doneCount}</span>/{items.length} 已扫描
                </span>
                <span className="text-xs text-zinc-200">
                  平均风险{' '}
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color: avgRisk < 30 ? '#10b981' : avgRisk < 65 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {avgRisk}
                  </span>
                </span>
              </div>
            )}
            {doneCount > 0 && (
              <button
                onClick={cleanAllItems}
                className="flex items-center gap-1.5 text-xs text-white hover:text-white bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all cursor-pointer no-drag"
              >
                <Broom size={13} weight="regular" />
                全部清理
              </button>
            )}
            {/* Scan selected / scan all */}
            {selectedCount > 0 && selectedCount < items.length ? (
              <button
                onClick={() => scanSelected(items)}
                disabled={!canScan}
                className="flex items-center gap-1.5 text-xs text-white bg-[#3b7cd4] hover:bg-[#4d8de0] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-all cursor-pointer no-drag font-medium"
              >
                <Play size={13} weight="fill" />
                {scanning ? '扫描中…' : `扫描已选 (${selectedCount})`}
              </button>
            ) : (
              <button
                onClick={() => scanAll(items)}
                disabled={scanning || items.every((i) => !i.originalText)}
                className="flex items-center gap-1.5 text-xs text-white bg-[#3b7cd4] hover:bg-[#4d8de0] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-all cursor-pointer no-drag font-medium"
              >
                <Play size={13} weight="fill" />
                {scanning ? '扫描中…' : '扫描全部'}
              </button>
            )}
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-red-400 transition-colors cursor-pointer no-drag"
            >
              <Trash size={13} weight="regular" />
              清空
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: input area */}
        <div className="w-80 flex-shrink-0 border-r border-white/[0.06] flex flex-col p-5 gap-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {([
              { id: 'file' as const, label: '文件', icon: <FileText size={12} /> },
              { id: 'text' as const, label: '文本', icon: <TextT size={12} /> },
            ]).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setInputMode(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all cursor-pointer ${inputMode === id ? 'bg-black/35 text-white' : 'text-zinc-300 hover:text-white'}`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {inputMode === 'file' ? (
            /* File drop zone */
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex-1 rounded-xl border-2 border-dashed cursor-pointer
                flex flex-col items-center justify-center gap-3 p-6
                transition-all duration-200
                ${isDragging
                  ? 'border-[#3b7cd4] bg-[#3b7cd4]/5'
                  : 'border-white/[0.08] hover:border-white/[0.20] bg-white/[0.03]'
                }
              `}
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <UploadSimple size={22} weight="regular" className="text-zinc-200" />
              </div>
              <div className="text-center">
                <p className="text-sm text-white font-medium">拖入多个文件</p>
                <p className="text-xs text-zinc-300 mt-1">点击或拖放 · .txt .md .docx .pdf</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.docx,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            /* Text segment input */
            <div className="flex-1 flex flex-col gap-3">
              <textarea
                value={segmentText}
                onChange={(e) => setSegmentText(e.target.value)}
                placeholder={`粘贴多段文本，用\n---\n分隔各段`}
                className="flex-1 bg-white/[0.03] rounded-xl border border-white/[0.07] text-sm text-zinc-200 leading-relaxed font-['Geist_Mono',monospace] resize-none px-4 py-3 focus:outline-none focus:border-[#3b7cd4]/40 placeholder:text-zinc-600"
                spellCheck={false}
              />
              <button
                onClick={handleAddSegments}
                disabled={!segmentText.trim()}
                className="flex items-center justify-center gap-1.5 text-xs text-zinc-200 bg-white/[0.06] hover:bg-white/[0.09] disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] px-3 py-2 rounded-lg transition-all cursor-pointer no-drag"
              >
                添加文本段落
              </button>
            </div>
          )}
        </div>

        {/* Right: results list */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-10">
              <div className="w-16 h-16 rounded-2xl border border-white/[0.07] bg-white/[0.02] flex items-center justify-center">
                <UploadSimple size={28} weight="regular" className="text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-200">拖入文件或粘贴文本段落开始批量检测</p>
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-2">
              {/* Select-all row */}
              <div className="flex items-center gap-2 px-1 pb-1">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs text-zinc-200 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  {allSelected ? (
                    <CheckSquare size={15} weight="fill" className="text-[#3b7cd4]" />
                  ) : someSelected ? (
                    <MinusSquare size={15} weight="fill" className="text-[#3b7cd4]/70" />
                  ) : (
                    <Square size={15} weight="regular" className="text-zinc-600" />
                  )}
                  {allSelected ? '取消全选' : '全选'}
                </button>
                {selectedCount > 0 && (
                  <span className="text-xs text-zinc-300">已选 {selectedCount} 项</span>
                )}
              </div>

              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <BatchItemCard
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onClean={() => cleanItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                    onSelect={() => toggleSelect(item.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BatchItemCard({
  item,
  expanded,
  onToggle,
  onClean,
  onRemove,
  onSelect,
}: {
  item: BatchItem
  expanded: boolean
  onToggle: () => void
  onClean: () => void
  onRemove: () => void
  onSelect: () => void
}) {
  const score = item.result?.riskScore ?? 0
  const scoreColor = score < 30 ? '#10b981' : score < 65 ? '#f59e0b' : '#ef4444'
  const riskLabel = score < 30 ? '低风险' : score < 65 ? '中等' : '高风险'
  const actionLabel = score === 0 ? '无异常' : score < 30 ? '可忽略' : score < 65 ? '建议清理' : '建议重写'

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`rounded-xl border overflow-hidden transition-colors ${
        item.selected
          ? 'bg-white/[0.04] border-white/[0.10]'
          : 'bg-white/[0.02] border-white/[0.05]'
      }`}
    >
      {/* Item header row */}
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          className="flex-shrink-0 text-zinc-300 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {item.selected ? (
            <CheckSquare size={15} weight="fill" className="text-[#3b7cd4]" />
          ) : (
            <Square size={15} weight="regular" />
          )}
        </button>

        {/* Status icon */}
        <div
          className="flex-shrink-0 cursor-pointer"
          onClick={item.status === 'done' ? onToggle : undefined}
        >
          {item.status === 'scanning' && (
            <div className="w-4 h-4 rounded-full border-2 border-t-[#3b7cd4] animate-spin" />
          )}
          {item.status === 'done' && (
            <CheckCircle size={16} weight="fill" style={{ color: scoreColor }} />
          )}
          {item.status === 'error' && (
            <WarningCircle size={16} weight="fill" className="text-red-400" />
          )}
          {item.status === 'pending' && (
            <div className="w-4 h-4 rounded-full border border-white/[0.20]" />
          )}
        </div>

        {/* Name + info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={item.status === 'done' ? onToggle : undefined}
        >
          <p className="text-sm text-white truncate font-medium">{item.name}</p>
          {item.status === 'done' && item.result && (
            <p className="text-xs text-zinc-300 mt-0.5">
              {item.result.totalChars.toLocaleString()} 字符 · 发现 {item.result.suspiciousCount} 处
            </p>
          )}
          {item.status === 'error' && (
            <p className="text-xs text-red-400 mt-0.5">{item.error}</p>
          )}
        </div>

        {/* Risk badge */}
        {item.status === 'done' && item.result && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-xs font-mono font-semibold tabular-nums px-2 py-0.5 rounded-md"
              style={{
                color: scoreColor,
                backgroundColor: `${scoreColor}15`,
                border: `1px solid ${scoreColor}30`,
              }}
            >
              {score}
            </span>
            <span className="text-xs text-zinc-200">{riskLabel}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{
                color: scoreColor,
                borderColor: `${scoreColor}30`,
                backgroundColor: `${scoreColor}10`,
              }}
            >
              {actionLabel}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.status === 'done' && !item.cleanedText && (
            <button
              onClick={(e) => { e.stopPropagation(); onClean() }}
              className="p-1.5 text-zinc-300 hover:text-zinc-200 hover:bg-white/[0.06] rounded transition-colors cursor-pointer"
              title="清理"
            >
              <Broom size={13} weight="regular" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="p-1.5 text-zinc-300 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
            title="移除"
          >
            <X size={13} weight="regular" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && item.result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-4">
              <StatsPanel result={item.result} />
              {item.cleanedText && (
                <div className="mt-4">
                  <p className="text-xs text-zinc-200 mb-2 uppercase tracking-wider">净化结果</p>
                  <textarea
                    value={item.cleanedText}
                    readOnly
                    rows={6}
                    className="w-full bg-black/30 rounded-lg border border-emerald-500/20 text-xs text-zinc-200 leading-relaxed font-['Geist_Mono',monospace] resize-none px-3 py-2.5 focus:outline-none"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
