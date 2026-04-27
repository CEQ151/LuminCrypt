import { motion } from 'framer-motion'
import {
  MagnifyingGlass,
  Tray,
  Fingerprint,
  GearSix,
  Clipboard,
  ImagesSquare,
} from '@phosphor-icons/react'
import { I18nKey, useI18n } from '../i18n'

export type PageId = 'detect' | 'batch' | 'watermark' | 'settings'

interface NavItem {
  id: PageId
  labelKey: I18nKey
  icon: React.ReactNode
  bottom?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'detect', labelKey: 'nav.detect', icon: <MagnifyingGlass size={18} weight="regular" /> },
  { id: 'batch', labelKey: 'nav.batch', icon: <Tray size={18} weight="regular" /> },
  { id: 'watermark', labelKey: 'nav.watermark', icon: <Fingerprint size={18} weight="regular" /> },
]

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', labelKey: 'nav.settings', icon: <GearSix size={18} weight="regular" />, bottom: true },
]

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  clipboardActive: boolean
  onClipboardToggle: () => void
  onBgSwitcher: () => void
  bgActive: boolean
}

export default function Sidebar({
  activePage,
  onNavigate,
  clipboardActive,
  onClipboardToggle,
  onBgSwitcher,
  bgActive,
}: SidebarProps) {
  const { t } = useI18n()

  return (
    <div className="w-[62px] flex-shrink-0 flex flex-col border-r border-white/[0.08] bg-[#07070b]/88 backdrop-blur-md relative z-10">
      {/* Top nav items */}
      <div className="flex flex-col items-center gap-2 pt-3.5 flex-1">
        {NAV_ITEMS.map(({ id, labelKey, icon }, index) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <NavButton
              active={activePage === id}
              label={t(labelKey)}
              onClick={() => onNavigate(id)}
            >
              {icon}
            </NavButton>
          </motion.div>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-1.5 pb-4">
        {/* Background switcher button */}
        <div className="relative group">
          <button
            onClick={onBgSwitcher}
            className={`
              w-9 h-9 flex items-center justify-center
              transition-colors duration-150 cursor-pointer desktop-btn
              ${
                bgActive
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/25'
                  : 'text-zinc-500 hover:text-zinc-100'
              }
            `}
          >
            <ImagesSquare size={17} weight={bgActive ? 'duotone' : 'regular'} />
          </button>
          <Tooltip label={t('nav.background')} />
        </div>

        {/* Clipboard toggle */}
        <div className="relative group">
          <button
            onClick={onClipboardToggle}
            className={`
              w-9 h-9 flex items-center justify-center
              transition-colors duration-150 cursor-pointer desktop-btn
              ${
                clipboardActive
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                  : 'text-zinc-500 hover:text-zinc-100'
              }
            `}
          >
            <Clipboard size={17} weight={clipboardActive ? 'fill' : 'regular'} />
            {clipboardActive && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </button>
          <Tooltip label={clipboardActive ? t('nav.clipboardOn') : t('nav.clipboard')} />
        </div>

        {BOTTOM_ITEMS.map(({ id, labelKey, icon }) => (
          <NavButton
            key={id}
            active={activePage === id}
            label={t(labelKey)}
            onClick={() => onNavigate(id)}
          >
            {icon}
          </NavButton>
        ))}
      </div>
    </div>
  )
}

function NavButton({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  label: string
  onClick: () => void
}) {
  // h-9 = 36px, h-5 = 20px → margin-top = (36-20)/2 = 8px
  // Use margin-top instead of CSS translate so Framer Motion layoutId
  // doesn't conflict with the vertical centering transform.
  return (
    <div className="relative group w-full h-9 flex justify-center items-center">
      {active && (
        <motion.span
          layoutId="sidebar-indicator"
          className="absolute left-0 w-0.5 h-5 bg-gradient-to-b from-cyan-400 to-purple-400 rounded-r-full pointer-events-none"
          style={{ top: '8px' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <button
        onClick={onClick}
        className={`
          w-9 h-9 flex items-center justify-center
          transition-colors duration-150 cursor-pointer desktop-btn
          ${
            active
              ? 'bg-cyan-400/10 text-cyan-200 border-cyan-400/25'
              : 'text-zinc-500 hover:text-zinc-100'
          }
        `}
      >
        {children}
      </button>
      <Tooltip label={label} />
    </div>
  )
}

function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="
        absolute left-full ml-3 top-1/2 -translate-y-1/2
        desktop-tooltip whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none
        transition-all duration-150 z-50
      "
    >
      {label}
    </div>
  )
}
