'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, LayoutGrid, Trophy, Building2, ImageIcon, Server, Trash2,
  Search, CornerDownLeft, ArrowRight,
} from 'lucide-react'
import { siteApi } from '@/lib/api'

interface CmdItem {
  id: string
  label: string
  hint?: string
  icon: any
  action: () => void
  group: string
}

export default function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [sites, setSites] = useState<any[]>([])
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      siteApi.getAll().then(r => { if (r.success) setSites(r.data || []) })
      setQuery(''); setSel(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const go = (path: string) => { router.push(path); onClose() }
  const pickSite = (id: string) => {
    localStorage.setItem('active_site', id)
    router.push('/admin/slots'); onClose()
  }

  const items: CmdItem[] = useMemo(() => {
    const nav: CmdItem[] = [
      { id: 'n1', label: 'Sites', icon: Globe, action: () => go('/admin/sites'), group: 'Điều hướng' },
      { id: 'n2', label: 'Slot Manager', icon: LayoutGrid, action: () => go('/admin/slots'), group: 'Điều hướng' },
      { id: 'n3', label: 'Toplist', icon: Trophy, action: () => go('/admin/toplist'), group: 'Điều hướng' },
      { id: 'n4', label: 'Brands', icon: Building2, action: () => go('/admin/brands'), group: 'Điều hướng' },
      { id: 'n5', label: 'Banner Pool', icon: ImageIcon, action: () => go('/admin/banners'), group: 'Điều hướng' },
      { id: 'n6', label: 'Image Domains', icon: Server, action: () => go('/admin/image-domains'), group: 'Điều hướng' },
      { id: 'n7', label: 'Recycle Bin', icon: Trash2, action: () => go('/admin/recycle'), group: 'Điều hướng' },
    ]
    const siteItems: CmdItem[] = sites.map(s => ({
      id: `s-${s.id}`, label: s.name, hint: 'Mở slot manager', icon: Globe,
      action: () => pickSite(s.id), group: 'Chuyển site',
    }))
    return [...nav, ...siteItems]
  }, [sites])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => { setSel(0) }, [query])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.action() }
      else if (e.key === 'Escape') { onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, sel])

  if (!open) return null

  // Group filtered items
  const groups: Record<string, CmdItem[]> = {}
  filtered.forEach(i => { (groups[i.group] ||= []).push(i) })
  let flatIdx = -1

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(24,24,27,0.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh',
      animation: 'overlay-in 0.15s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '560px', maxWidth: '90vw', background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)', overflow: 'hidden',
        animation: 'modal-in 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Tìm trang, chuyển site..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', background: 'transparent', color: 'var(--text)' }}
          />
          <kbd style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không tìm thấy "{query}"
            </div>
          ) : (
            Object.entries(groups).map(([groupName, groupItems]) => (
              <div key={groupName} style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {groupName}
                </div>
                {groupItems.map(item => {
                  flatIdx++
                  const active = flatIdx === sel
                  const Icon = item.icon
                  return (
                    <div key={item.id} onClick={item.action}
                      onMouseEnter={() => setSel(filtered.indexOf(item))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        background: active ? 'var(--accent-subtle)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text)',
                      }}>
                      <Icon size={15} strokeWidth={1.8} />
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: active ? 550 : 450 }}>{item.label}</span>
                      {item.hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.hint}</span>}
                      {active && <CornerDownLeft size={13} color="var(--accent)" />}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '9px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> di chuyển</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={kbdStyle}>↵</kbd> chọn</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
  background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)',
}
