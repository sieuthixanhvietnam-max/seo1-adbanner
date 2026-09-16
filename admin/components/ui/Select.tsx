'use client'
import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  icon?: ReactNode          // leading icon/element per option
  dot?: string              // màu chấm trạng thái (vd PLACEMENT_COLORS[p])
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  leadingIcon?: ReactNode   // icon cố định bên trái trigger
  searchable?: boolean      // auto bật khi > 8 options nếu không set
  disabled?: boolean
  width?: number | string   // mặc định 100%
  minWidth?: number
  size?: 'sm' | 'md'
  align?: 'left' | 'right'
  footer?: ReactNode        // nội dung ghim đáy panel (vd link "Quản lý")
}

export function Select({
  value, onChange, options, placeholder = 'Chọn...', leadingIcon,
  searchable, disabled, width = '100%', minWidth = 160, size = 'md', align = 'left', footer,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const useSearch = searchable ?? options.length > 8
  const current = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    if (!useSearch || !query) return options
    const q = query.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [options, query, useSearch])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      const idx = filtered.findIndex(o => o.value === value)
      setHighlight(idx >= 0 ? idx : 0)
      if (useSearch) setTimeout(() => searchRef.current?.focus(), 10)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (opt: SelectOption) => {
    if (opt.disabled) return
    onChange(opt.value); setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ')) { e.preventDefault(); setOpen(true); return }
    if (!open) return
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); const opt = filtered[highlight]; if (opt) pick(opt) }
  }

  const h = size === 'sm' ? 30 : 34

  return (
    <div ref={ref} style={{ position: 'relative', width, minWidth }}>
      <button
        type="button" onClick={() => !disabled && setOpen(o => !o)} onKeyDown={onKeyDown} disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          height: `${h}px`, padding: '0 10px',
          background: 'var(--bg)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border-strong)'}`,
          boxShadow: open ? '0 0 0 3px var(--accent-subtle)' : 'none',
          borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 500, color: current ? 'var(--text)' : 'var(--text-muted)',
          opacity: disabled ? 0.55 : 1, transition: 'border-color 0.12s, box-shadow 0.12s',
        }}
      >
        {leadingIcon}
        {current?.dot && <span className="dot" style={{ background: current.dot }} />}
        {current?.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{current.icon}</span>}
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label || placeholder}
        </span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: `${h + 4}px`, [align]: 0, minWidth: '100%', width: 'max-content', maxWidth: '320px',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 400,
          overflow: 'hidden', animation: 'modal-in 0.14s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {useSearch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setHighlight(0) }}
                onKeyDown={onKeyDown} placeholder="Tìm..."
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--text)' }}
              />
            </div>
          )}
          <div style={{ padding: '5px', maxHeight: '280px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>Không có kết quả</div>
            ) : filtered.map((opt, i) => {
              const selected = opt.value === value
              const active = i === highlight
              return (
                <button
                  key={opt.value} type="button" onClick={() => pick(opt)} onMouseEnter={() => setHighlight(i)} disabled={opt.disabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)', border: 'none', textAlign: 'left', cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    background: selected ? 'var(--accent-subtle)' : active ? 'var(--bg-hover)' : 'transparent',
                    color: opt.disabled ? 'var(--text-muted)' : selected ? 'var(--accent)' : 'var(--text)',
                    fontWeight: selected ? 550 : 450, fontSize: '13px', opacity: opt.disabled ? 0.6 : 1,
                  }}
                >
                  {opt.dot && <span className="dot" style={{ background: opt.dot }} />}
                  {opt.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{opt.icon}</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                    {opt.description && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{opt.description}</span>}
                  </span>
                  {selected && <Check size={14} style={{ flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
          {footer && <div style={{ borderTop: '1px solid var(--border)', padding: '5px' }}>{footer}</div>}
        </div>
      )}
    </div>
  )
}
