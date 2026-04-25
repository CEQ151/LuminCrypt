import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { MagnifyingGlass, CircleNotch } from '@phosphor-icons/react'

interface ScanButtonProps {
  onClick: () => void
  disabled?: boolean
  scanning?: boolean
}

export default function ScanButton({ onClick, disabled, scanning }: ScanButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const translateX = useTransform(mouseX, [-60, 60], [-5, 5])
  const translateY = useTransform(mouseY, [-30, 30], [-3, 3])

  function onMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    mouseX.set(e.clientX - cx)
    mouseY.set(e.clientY - cy)
  }

  function onMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <motion.button
      ref={ref}
      style={{ x: translateX, y: translateY }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled || scanning}
      className="
        relative flex items-center gap-2.5 px-6 py-2.5
        rounded-xl font-medium text-sm tracking-wide desktop-btn
        overflow-hidden
        cursor-pointer no-drag select-none
        disabled:opacity-40 disabled:cursor-not-allowed
      "
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/80 to-blue-500/75 transition-all duration-200" />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/80 to-blue-400/80 opacity-0 hover:opacity-100 transition-opacity duration-150" />
      {/* Inner glow */}
      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] rounded-xl" />
      {/* Border */}
      <div className="absolute inset-0 rounded-xl border border-white/15" />
      {/* Scanning ripple effect */}
      {scanning && (
        <>
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-cyan-400/30"
            animate={{ scale: [1, 1.15], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-purple-400/20"
            animate={{ scale: [1, 1.25], opacity: [0.4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
        </>
      )}

      <span className="relative z-10 flex items-center gap-2.5 text-white">
        {scanning ? (
          <CircleNotch size={15} weight="regular" className="animate-spin" />
        ) : (
          <MagnifyingGlass size={15} weight="regular" />
        )}
        <span>{scanning ? '扫描中...' : '扫描文本'}</span>
        {!disabled && !scanning && (
          <span className="ml-1 text-[10px] text-white/40 font-mono">⌘↵</span>
        )}
      </span>
    </motion.button>
  )
}
