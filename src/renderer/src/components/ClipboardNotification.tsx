import { motion } from 'framer-motion'
import { Clipboard, MagnifyingGlass, X } from '@phosphor-icons/react'

interface ClipboardNotificationProps {
  text: string
  onScan: (text: string) => void
  onDismiss: () => void
}

export default function ClipboardNotification({
  text,
  onScan,
  onDismiss,
}: ClipboardNotificationProps) {
  const preview = text.length > 60 ? text.slice(0, 60).replace(/\n/g, ' ') + '…' : text.replace(/\n/g, ' ')

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-4 py-2.5 bg-black/30/80 border-b border-amber-500/20 flex-shrink-0 backdrop-blur-md"
    >
      <Clipboard size={14} weight="fill" className="text-amber-400 flex-shrink-0" />
      <span className="flex-1 text-xs text-amber-200/80 truncate min-w-0 font-mono">
        {preview}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onScan(text)}
          className="flex items-center gap-1.5 text-xs text-amber-200 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 px-2.5 py-1 rounded-lg transition-all duration-300 cursor-pointer no-drag"
        >
          <MagnifyingGlass size={11} weight="regular" />
          扫描
        </button>
        <button
          onClick={onDismiss}
          className="p-1 text-amber-500/60 hover:text-amber-300 transition-colors cursor-pointer no-drag"
        >
          <X size={13} weight="regular" />
        </button>
      </div>
    </motion.div>
  )
}
