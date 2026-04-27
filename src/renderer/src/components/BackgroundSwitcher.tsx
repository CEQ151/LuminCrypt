import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ImagesSquare, UploadSimple, Trash } from '@phosphor-icons/react'
import { useI18n } from '../i18n'

interface BackgroundSwitcherProps {
  open: boolean
  currentBg: string | null
  onSelect: (url: string | null) => void
  onClose: () => void
}

export default function BackgroundSwitcher({
  open,
  currentBg,
  onSelect,
  onClose,
}: BackgroundSwitcherProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onSelect(url)
    onClose()
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleRemove = () => {
    if (currentBg && currentBg.startsWith('blob:')) {
      URL.revokeObjectURL(currentBg)
    }
    onSelect(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[90]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-[68px] top-1/2 z-[91] w-[300px]"
            style={{ translateY: '-50%' }}
            initial={{ opacity: 0, x: 24, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: 'rgba(8, 8, 18, 0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.08)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.25)' }}
                  >
                    <ImagesSquare size={15} className="text-cyan-400" weight="duotone" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">
                    {t('background.title')}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-all cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col gap-3">
                {/* Current preview */}
                {currentBg ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <img
                      src={currentBg}
                      alt="current background"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                      <span className="text-[10px] text-white/60">{t('background.currentCustom')}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-600"
                    style={{ aspectRatio: '16/9', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}
                  >
                    <ImagesSquare size={24} weight="duotone" />
                    <span className="text-[11px]">{t('background.currentCosmic')}</span>
                  </div>
                )}

                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="
                    flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                    text-xs font-medium text-cyan-300
                    bg-cyan-400/10 hover:bg-cyan-400/15
                    border border-cyan-400/20 hover:border-cyan-400/35
                    transition-all duration-200 cursor-pointer
                  "
                >
                  <UploadSimple size={14} weight="bold" />
                  {t('background.upload')}
                </button>

                {/* Remove button (only when custom bg is set) */}
                {currentBg && (
                  <button
                    onClick={handleRemove}
                    className="
                      flex items-center justify-center gap-2 w-full py-2 rounded-xl
                      text-xs text-zinc-300 hover:text-red-400
                      bg-transparent hover:bg-red-500/10
                      border border-white/[0.05] hover:border-red-500/20
                      transition-all duration-200 cursor-pointer
                    "
                  >
                    <Trash size={13} weight="regular" />
                    {t('background.restore')}
                  </button>
                )}

                <p className="text-[10px] text-zinc-700 text-center">
                  {t('background.supports')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
