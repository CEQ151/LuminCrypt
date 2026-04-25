import { useEffect, useRef, useState } from 'react'

/**
 * Polls clipboard via IPC and returns new text when it changes.
 * Only active when `enabled` is true.
 */
export function useClipboard(enabled: boolean, intervalMs = 1500) {
  const [clipboardText, setClipboardText] = useState<string | null>(null)
  const lastTextRef = useRef<string>('')
  const warnedRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setClipboardText(null)
      return
    }

    const poll = async () => {
      try {
        const text = await window.api.readClipboard()
        if (text && text !== lastTextRef.current && text.trim().length > 0) {
          lastTextRef.current = text
          setClipboardText(text)
        }
      } catch (err) {
        if (!warnedRef.current) {
          warnedRef.current = true
          console.warn('[clipboard] IPC read failed:', err)
        }
      }
    }

    // Initial read
    poll()
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])

  const clearClipboard = () => setClipboardText(null)

  return { clipboardText, clearClipboard }
}
