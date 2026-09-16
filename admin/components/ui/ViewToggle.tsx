'use client'
import { useState, useEffect } from 'react'
import { LayoutGrid, Table2 } from 'lucide-react'

export type ViewMode = 'cards' | 'table'

/**
 * Nhớ chế độ hiển thị per-page trong localStorage.
 * Hydration-safe: luôn trả default ở lần render đầu (server + client), đọc storage sau khi mount.
 */
export function useViewMode(pageKey: string, initial: ViewMode = 'cards') {
  const [mode, setMode] = useState<ViewMode>(initial)
  useEffect(() => {
    const stored = localStorage.getItem(`view_mode:${pageKey}`)
    if (stored === 'cards' || stored === 'table') setMode(stored)
  }, [pageKey])
  const set = (m: ViewMode) => { setMode(m); localStorage.setItem(`view_mode:${pageKey}`, m) }
  return [mode, set] as const
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const items: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
    { mode: 'cards', icon: LayoutGrid, label: 'Thẻ' },
    { mode: 'table', icon: Table2, label: 'Bảng' },
  ]
  return (
    <div style={{ display: 'inline-flex', gap: '2px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      {items.map(({ mode, icon: Icon, label }) => {
        const active = value === mode
        return (
          <button
            key={mode} type="button" onClick={() => onChange(mode)} title={label}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px',
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
              fontWeight: active ? 550 : 450,
              background: active ? 'var(--bg)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none', transition: 'all 0.12s',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        )
      })}
    </div>
  )
}
