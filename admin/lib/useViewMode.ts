'use client'
import { useState, useEffect } from 'react'

export type ViewMode = 'cards' | 'table'

/**
 * Nhớ chế độ hiển thị per-page trong localStorage.
 * Hydration-safe: luôn trả default ở lần render đầu (server + client), đọc storage sau khi mount.
 */
export function useViewMode(pageKey: string, initial: ViewMode = 'cards') {
  const [mode, setMode] = useState<ViewMode>(initial)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`view_mode:${pageKey}`)
      if (stored === 'cards' || stored === 'table') setMode(stored)
    } catch {}
  }, [pageKey])
  const set = (m: ViewMode) => {
    setMode(m)
    try { localStorage.setItem(`view_mode:${pageKey}`, m) } catch {}
  }
  return [mode, set] as const
}
