import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Broom, ArrowCounterClockwise, WarningCircle } from '@phosphor-icons/react'

import TitleBar from './components/TitleBar'
import Sidebar, { PageId } from './components/Sidebar'
import DropZone from './components/DropZone'
import ScanButton from './components/ScanButton'
import HighlightView from './components/HighlightView'
import StatsPanel from './components/StatsPanel'
import ExportMenu from './components/ExportMenu'
import WatermarkTab from './components/WatermarkTab'
import BatchMode from './components/BatchMode'
import ClipboardNotification from './components/ClipboardNotification'
import CosmicBackground from './components/CosmicBackground'
import BackgroundSwitcher from './components/BackgroundSwitcher'
import { useDetection } from './hooks/useDetection'
import { useClipboard } from './hooks/useClipboard'
import { useSettings } from './contexts/SettingsContext'
import { useBatch } from './hooks/useBatch'
import { cleanAll } from './core/cleaner'

const CompareView = lazy(() => import('./components/CompareView'))
const SettingsPage = lazy(() => import('./components/SettingsPage'))

function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState<PageId>('detect')
  const { status, result, text, setText, runScan, reset, errorMessage } = useDetection()
  const [activeTab, setActiveTab] = useState<'highlight' | 'cleaned' | 'compare'>('highlight')
  const [cleaned, setCleaned] = useState<string | null>(null)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [showBgPanel, setShowBgPanel] = useState(false)

  const { settings, updateSettings } = useSettings()
  const batchHook = useBatch()

  const handleBgSelect = useCallback((url: string | null) => {
    setBgImageUrl(url)
  }, [])
  const { clipboardText, clearClipboard } = useClipboard(
    settings.clipboardEnabled,
    settings.clipboardIntervalMs
  )

  // Ctrl/Cmd+Enter triggers scan
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activePage === 'detect') {
        e.preventDefault()
        if (text.trim()) runScan()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [text, runScan, activePage])

  const handleClean = useCallback(() => {
    if (!text) return
    setCleaned(cleanAll(text))
    setActiveTab('cleaned')
  }, [text])

  const handleReset = useCallback(() => {
    reset()
    setCleaned(null)
    setActiveTab('highlight')
  }, [reset])

  const handleClipboardScan = useCallback(
    (clipText: string) => {
      setText(clipText)
      clearClipboard()
      setActivePage('detect')
      setCleaned(null)
      setActiveTab('highlight')
      setTimeout(() => runScan(), 50)
    },
    [setText, clearClipboard, runScan]
  )

  const scanning = status === 'scanning'
  const hasScan = status === 'done' && result !== null
  const hasError = status === 'error'

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative">
      {/* Cosmic particle background */}
      <CosmicBackground bgImageUrl={bgImageUrl} />
      {/* Grain overlay */}
      <div className="cosmic-grain" />

      {/* Background switcher panel */}
      <BackgroundSwitcher
        open={showBgPanel}
        currentBg={bgImageUrl}
        onSelect={handleBgSelect}
        onClose={() => setShowBgPanel(false)}
      />

      <TitleBar />

      {/* Clipboard notification banner */}
      <AnimatePresence>
        {clipboardText && (
          <ClipboardNotification
            text={clipboardText}
            onScan={handleClipboardScan}
            onDismiss={clearClipboard}
          />
        )}
      </AnimatePresence>

      {/* Body: sidebar + page */}
      <div className="flex flex-1 min-h-0 relative z-[1]">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          clipboardActive={settings.clipboardEnabled}
          onClipboardToggle={() => updateSettings('clipboardEnabled', !settings.clipboardEnabled)}
          onBgSwitcher={() => setShowBgPanel((v) => !v)}
          bgActive={bgImageUrl !== null}
        />

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {/* ── Detect page ───────────────────────────────── */}
            {activePage === 'detect' && (
              <motion.div
                key="detect"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full grid grid-cols-[1fr_1.45fr]"
              >
                {/* Left: input */}
                <div className="flex flex-col min-h-0 border-r border-white/[0.06] p-5 gap-4">
                  <DropZone
                    text={text}
                    onChange={(t) => { setText(t); setCleaned(null) }}
                    disabled={scanning}
                  />
                  <div className="flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <ScanButton onClick={runScan} disabled={!text.trim()} scanning={scanning} />
                      {hasScan && (
                        <motion.button
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                          onClick={handleClean}
                          className="cosmic-btn flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl cursor-pointer no-drag"
                        >
                          <Broom size={13} weight="regular" />
                          清理
                        </motion.button>
                      )}
                    </div>
                    {(hasScan || text) && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-cyan-300 transition-colors duration-300 cursor-pointer no-drag"
                      >
                        <ArrowCounterClockwise size={12} weight="regular" />
                        重置
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Right: results */}
                <div className="flex flex-col min-h-0">
                  <AnimatePresence mode="wait">
                    {!hasScan && status !== 'scanning' && (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="flex-1 flex flex-col items-center justify-center gap-5 p-10"
                      >
                        {/* Orbital scanner illustration */}
                        <div className="relative w-24 h-24">
                          {/* Outer ring */}
                          <div className="absolute inset-0 rounded-full border border-cyan-400/10 orbit-spin-slow" />
                          <div className="absolute inset-2 rounded-full border border-purple-400/8 orbit-spin-reverse" />
                          <div className="absolute inset-4 rounded-full border border-cyan-400/6 orbit-spin" />
                          {/* Center core */}
                          <div className="absolute inset-6 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/[0.06] flex items-center justify-center">
                            <div className="w-8 h-8 flex flex-col gap-1 justify-center">
                              {[70, 90, 55, 80, 45].map((w, i) => (
                                <motion.div
                                  key={i}
                                  className="h-0.5 rounded-full bg-cyan-400/30"
                                  style={{ width: `${w}%` }}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ delay: i * 0.1, duration: 0.6 }}
                                />
                              ))}
                            </div>
                          </div>
                          {/* Scan line */}
                          <div className="absolute inset-0 overflow-hidden rounded-full">
                            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent scan-animate" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-white">
                            粘贴文本，按{' '}
                            <kbd className="font-mono text-[11px] bg-white/[0.07] border border-white/[0.1] px-1.5 py-0.5 rounded-md text-cyan-300/80">Ctrl+↵</kbd>
                            {' '}开始扫描
                          </p>
                          <p className="text-xs text-zinc-600 mt-2 tracking-wide">检测零宽字符、同形字、BiDi 控制码、Tags 区块等</p>
                        </div>
                      </motion.div>
                    )}

                    {status === 'scanning' && (
                      <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center gap-4"
                      >
                        <div className="relative w-16 h-16">
                          {/* Orbital rings */}
                          <div className="absolute inset-0 rounded-full border-2 border-cyan-400/10 orbit-spin-slow" />
                          <div className="absolute inset-2 rounded-full border-2 border-purple-400/10 orbit-spin-reverse" />
                          <div className="absolute inset-0 rounded-full border-2 border-t-cyan-400/60 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1s' }} />
                          {/* Center glow */}
                          <div className="absolute inset-5 rounded-full bg-cyan-400/10 animate-pulse" />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <p className="text-sm text-cyan-300/70 font-medium tracking-wide">正在分析字符</p>
                          <p className="text-xs text-zinc-600 font-mono">SCANNING UNICODE STREAM...</p>
                        </div>
                      </motion.div>
                    )}

                    {hasError && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center gap-4 p-10"
                      >
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                          <WarningCircle size={24} weight="regular" className="text-red-400" />
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <p className="text-sm text-red-400 font-medium">扫描失败</p>
                          <p className="text-xs text-zinc-500 max-w-xs">{errorMessage || '未知错误，请重试'}</p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleReset}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-cyan-300 transition-colors cursor-pointer no-drag mt-2"
                        >
                          <ArrowCounterClockwise size={12} weight="regular" />
                          重置
                        </motion.button>
                      </motion.div>
                    )}

                    {hasScan && result && (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 min-h-0 flex flex-col"
                      >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
                          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-0.5 border border-white/[0.06]">
                            {([
                              { id: 'highlight' as const, label: '标注视图' },
                              ...(cleaned ? [
                                { id: 'cleaned' as const, label: '净化文本' },
                                { id: 'compare' as const, label: '对比' },
                              ] : []),
                            ]).map(({ id, label }) => (
                              <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-300 cursor-pointer ${activeTab === id ? 'bg-white/[0.08] text-cyan-300 shadow-sm' : 'text-zinc-600 hover:text-white'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-zinc-600 tabular-nums">发现 {result.suspiciousCount} 处</span>
                            <ExportMenu result={result} originalText={text} />
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto]">
                          <div className="min-h-0 p-4">
                            <AnimatePresence mode="wait">
                              {activeTab === 'highlight' && (
                                <motion.div key="highlight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                  <HighlightView text={text} result={result} />
                                </motion.div>
                              )}
                              {activeTab === 'cleaned' && cleaned && (
                                <motion.div key="cleaned" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                  <textarea value={cleaned} readOnly className="w-full h-full bg-black/25 rounded-xl border border-emerald-500/20 text-sm text-white leading-relaxed font-['Geist_Mono',monospace] resize-none px-4 py-3.5 focus:outline-none" spellCheck={false} />
                                </motion.div>
                              )}
                              {activeTab === 'compare' && cleaned && (
                                <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                  <Suspense fallback={null}>
                                    <CompareView originalText={text} cleanedText={cleaned} result={result} />
                                  </Suspense>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="border-t border-white/[0.06] p-4 overflow-y-auto max-h-72">
                            <StatsPanel result={result} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* ── Batch page ────────────────────────────────── */}
            {activePage === 'batch' && (
              <motion.div key="batch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
                <BatchMode batchHook={batchHook} />
              </motion.div>
            )}

            {/* ── Watermark page ────────────────────────────── */}
            {activePage === 'watermark' && (
              <motion.div key="watermark" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col">
                <WatermarkTab />
              </motion.div>
            )}

            {/* ── Settings page ─────────────────────────────── */}
            {activePage === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
                <Suspense fallback={null}>
                  <SettingsPage />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default App
