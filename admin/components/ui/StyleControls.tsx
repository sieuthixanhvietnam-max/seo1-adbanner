'use client'
import { useState, useRef, useEffect } from 'react'

// ─── Slider (number) ──────────────────────────────────────────────────────────
export function SliderControl({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label className="label" style={{ margin: 0 }}>{label}</label>
        <span className="mono" style={{ color: 'var(--text)', fontWeight: 500 }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
    </div>
  )
}

// ─── Color picker ─────────────────────────────────────────────────────────────
export function ColorControl({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label className="label">{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '34px', height: '34px', flexShrink: 0 }}>
          <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: value, border: '1px solid var(--border-strong)' }} />
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
        <input className="input mono" value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function ToggleControl({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <label className="label" style={{ margin: 0 }}>{label}</label>
      <button onClick={() => onChange(!value)}
        style={{
          width: '38px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
          background: value ? 'var(--accent)' : 'var(--border-strong)', position: 'relative', transition: 'background 0.15s',
        }}>
        <span style={{ position: 'absolute', width: '18px', height: '18px', background: '#fff', borderRadius: '50%', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

// ─── Segmented (select) ───────────────────────────────────────────────────────
export function SegmentControl({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label className="label">{label}</label>
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            style={{
              flex: 1, height: '28px', border: 'none', borderRadius: '5px', cursor: 'pointer',
              fontSize: '12px', fontWeight: value === opt.value ? 550 : 450,
              background: value === opt.value ? 'var(--bg)' : 'transparent',
              color: value === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
              boxShadow: value === opt.value ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.12s',
            }}>{opt.label}</button>
        ))}
      </div>
    </div>
  )
}
