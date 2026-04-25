import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Category } from '../core/categories'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Settings {
  enabledCategories: Record<Category, boolean>
  thresholds: { lowMid: number; midHigh: number }
  clipboardEnabled: boolean
  clipboardIntervalMs: number
}

const ALL_CATEGORIES = Object.values(Category) as Category[]

export const DEFAULT_SETTINGS: Settings = {
  enabledCategories: Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, true])
  ) as Record<Category, boolean>,
  thresholds: { lowMid: 30, midHigh: 65 },
  clipboardEnabled: false,
  clipboardIntervalMs: 1500,
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: Settings
  ready: boolean
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  updateSettings: () => {},
  resetSettings: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

function mergeWithDefaults(stored: Record<string, unknown>): Settings {
  return {
    enabledCategories: {
      ...DEFAULT_SETTINGS.enabledCategories,
      ...((stored.enabledCategories as Record<Category, boolean>) ?? {}),
    },
    thresholds: {
      ...DEFAULT_SETTINGS.thresholds,
      ...((stored.thresholds as Settings['thresholds']) ?? {}),
    },
    clipboardEnabled: (stored.clipboardEnabled as boolean) ?? DEFAULT_SETTINGS.clipboardEnabled,
    clipboardIntervalMs:
      (stored.clipboardIntervalMs as number) ?? DEFAULT_SETTINGS.clipboardIntervalMs,
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    window.api.storeGetAll().then((stored) => {
      setSettings(mergeWithDefaults(stored))
      setReady(true)
    })
  }, [])

  const updateSettings = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    window.api.storeSet(key as string, value)
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      window.api.storeSet(key as string, DEFAULT_SETTINGS[key])
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, ready, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
