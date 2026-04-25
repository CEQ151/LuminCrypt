import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, FilePdf, FileDoc, UploadSimple, X, WarningCircle } from '@phosphor-icons/react'
import { parseFile } from '../core/parsers'

interface DropZoneProps {
  text: string
  onChange: (text: string) => void
  disabled?: boolean
}

export default function DropZone({ text, onChange, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null)
      setIsParsing(true)
      setFileName(file.name)
      try {
        const extracted = await parseFile(file)
        onChange(extracted)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file')
        setFileName(null)
      } finally {
        setIsParsing(false)
      }
    },
    [onChange]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const charCount = Array.from(text).length

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar row */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-cyan-300/60 uppercase tracking-widest">
            输入文本
          </span>
          {fileName && (
            <span className="flex items-center gap-1 text-xs text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full">
              <FileText size={10} />
              {fileName}
              <button
                onClick={() => { setFileName(null); onChange('') }}
                className="ml-0.5 text-zinc-600 hover:text-zinc-200 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {charCount > 0 && (
            <span className="text-xs text-zinc-600 font-mono tabular-nums">
              {charCount.toLocaleString()} 字符
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || disabled}
            className="
              flex items-center gap-1.5 text-xs text-zinc-200 hover:text-white
              px-3 py-1.5 rounded-xl
              transition-colors duration-150 cursor-pointer desktop-btn
              disabled:opacity-40 disabled:cursor-not-allowed no-drag
            "
          >
            <UploadSimple size={13} weight="regular" />
            <span>导入文件</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,.docx,.pdf"
            className="hidden"
            onChange={onFileSelect}
          />
        </div>
      </div>

      {/* Text area / Drop zone */}
      <div className="relative flex-1 min-h-0">
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="
                absolute inset-0 z-10 rounded-xl
                border-2 border-cyan-400/40 border-dashed
                bg-cyan-400/5
                flex flex-col items-center justify-center gap-3
                pointer-events-none
              "
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
                <UploadSimple size={20} weight="regular" className="text-cyan-400" />
              </div>
              <span className="text-sm text-cyan-300 font-medium">松开以导入文件</span>
              <span className="text-xs text-cyan-400/60">.txt .md .docx .pdf</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Parsing skeleton */}
        <AnimatePresence>
          {isParsing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 rounded-xl bg-black/30 flex flex-col gap-3 p-4"
            >
              {[100, 85, 92, 70, 88, 60].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded skeleton-cosmic"
                  style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          value={text}
          onChange={(e) => { setFileName(null); onChange(e.target.value) }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          disabled={disabled}
          placeholder="粘贴或输入文本 — 或拖入 .txt .md .docx .pdf 文件…"
          className="
            w-full h-full
            desktop-input
            text-sm text-white leading-relaxed
            font-mono resize-none
            px-4 py-3.5
            placeholder:text-zinc-700
            focus:outline-none
            transition-all duration-150
            disabled:opacity-50
          "
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {/* Empty state decoration */}
        <AnimatePresence>
          {!text && !isParsing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3 }}
              className="
                absolute bottom-6 left-1/2 -translate-x-1/2
                flex flex-col items-center gap-3
                pointer-events-none
              "
            >
              <div className="flex items-center gap-2 text-zinc-700">
                <FileText size={14} />
                <FilePdf size={14} />
                <FileDoc size={14} />
              </div>
              <span className="text-xs text-zinc-700 whitespace-nowrap">
                Supports .txt .md .docx .pdf
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Parse error */}
      <AnimatePresence>
        {parseError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex-shrink-0"
          >
            <WarningCircle size={13} />
            <span>{parseError}</span>
            <button
              onClick={() => setParseError(null)}
              className="ml-auto text-red-400/60 hover:text-red-400 cursor-pointer"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
