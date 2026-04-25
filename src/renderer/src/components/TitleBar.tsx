import { Minus, Square, X, Planet } from '@phosphor-icons/react'

export default function TitleBar() {
  const minimize = () => window.api.minimizeWindow()
  const maximize = () => window.api.maximizeWindow()
  const close = () => window.api.closeWindow()

  return (
    <div
      className="drag-region native-titlebar flex items-center justify-between h-10 px-3 flex-shrink-0 relative z-10"
      onDoubleClick={maximize}
    >
      {/* App identity */}
      <div className="flex items-center gap-2 no-drag">
        {/* Orbital icon */}
        <div className="relative w-[22px] h-[22px] flex items-center justify-center flex-shrink-0">
          <div className="absolute inset-0 rounded-full border border-cyan-400/20 orbit-spin-slow" />
          <div className="absolute inset-[3px] rounded-full border border-purple-400/15 orbit-spin-reverse" />
          <Planet size={14} weight="fill" className="text-cyan-400/70 relative z-10" />
        </div>
        {/* Compact title */}
        <div className="flex items-baseline gap-1">
          <span className="font-display-en text-[17px] text-zinc-100 leading-none">
            LuminCrypt
          </span>
          <span className="text-[9px] font-medium tracking-[0.18em] text-zinc-500 uppercase leading-none">
            Studio
          </span>
        </div>
      </div>

      {/* Window controls */}
      <div className="native-window-controls no-drag">
        <button
          onClick={minimize}
          className="cursor-pointer"
          aria-label="Minimize"
        >
          <Minus size={12} weight="regular" />
        </button>
        <button
          onClick={maximize}
          className="cursor-pointer"
          aria-label="Maximize"
        >
          <Square size={11} weight="regular" />
        </button>
        <button
          onClick={close}
          className="native-close cursor-pointer"
          aria-label="Close"
        >
          <X size={12} weight="regular" />
        </button>
      </div>
    </div>
  )
}
