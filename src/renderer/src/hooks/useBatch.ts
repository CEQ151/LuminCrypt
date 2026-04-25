import { useCallback, useState } from 'react'
import { ScanResult } from '../core/detector'
import { cleanAll } from '../core/cleaner'
import { parseFile } from '../core/parsers'
import { scanAsync } from '../core/scanWorkerClient'

export interface BatchItem {
  id: string
  name: string
  originalText: string
  result: ScanResult | null
  cleanedText: string | null
  status: 'pending' | 'scanning' | 'done' | 'error'
  error?: string
  selected: boolean
}

export function useBatch() {
  const [items, setItems] = useState<BatchItem[]>([])
  const [scanning, setScanning] = useState(false)

  const addFiles = useCallback(async (files: File[]) => {
    const newItems: BatchItem[] = files.map((f) => ({
      id: `${Date.now()}-${f.name}`,
      name: f.name,
      originalText: '',
      result: null,
      cleanedText: null,
      status: 'pending',
      selected: true,
    }))
    setItems((prev) => [...prev, ...newItems])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const itemId = newItems[i].id
      try {
        const text = await parseFile(file)
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, originalText: text } : item))
        )
      } catch (err) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, status: 'error', error: String(err) }
              : item
          )
        )
      }
    }
  }, [])

  const addSegments = useCallback((text: string) => {
    const segments = text.split(/\n---+\n/).map((s) => s.trim()).filter(Boolean)
    const newItems: BatchItem[] = segments.map((seg, i) => ({
      id: `seg-${Date.now()}-${i}`,
      name: `片段 ${i + 1}`,
      originalText: seg,
      result: null,
      cleanedText: null,
      status: 'pending',
      selected: true,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    )
  }, [])

  const toggleSelectAll = useCallback(() => {
    setItems((prev) => {
      const allSelected = prev.every((i) => i.selected)
      return prev.map((item) => ({ ...item, selected: !allSelected }))
    })
  }, [])

  const scanSelected = useCallback(async (currentItems: BatchItem[]) => {
    const toScan = currentItems.filter((i) => i.selected && i.originalText)
    if (toScan.length === 0) return
    setScanning(true)
    setItems((prev) =>
      prev.map((item) =>
        item.selected && item.originalText
          ? { ...item, status: 'scanning' as const }
          : item
      )
    )

    for (const item of toScan) {
      try {
        const result = await scanAsync(item.originalText)
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, result, status: 'done' } : i))
        )
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'error', error: String(err) } : i
          )
        )
      }
    }
    setScanning(false)
  }, [])

  const scanAll = useCallback(async (currentItems: BatchItem[]) => {
    setScanning(true)
    setItems((prev) => prev.map((item) => ({ ...item, status: 'scanning' as const })))

    for (const item of currentItems) {
      if (!item.originalText) continue
      try {
        const result = await scanAsync(item.originalText)
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, result, status: 'done' } : i))
        )
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'error', error: String(err) } : i
          )
        )
      }
    }
    setScanning(false)
  }, [])

  const cleanItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, cleanedText: cleanAll(item.originalText) } : item
      )
    )
  }, [])

  const cleanAllItems = useCallback(() => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === 'done' ? { ...item, cleanedText: cleanAll(item.originalText) } : item
      )
    )
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAll = useCallback(() => setItems([]), [])

  return {
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
  }
}
