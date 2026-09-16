'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Trophy, Building2, ImageIcon, Server, Trash2,
  Globe, Command, ChevronLeft, ChevronRight, Link2,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navGroups = [
  {
    label: 'Vận hành',
    items: [
      { href: '/admin/sites',         label: 'Sites',        icon: Globe },
      { href: '/admin/slots',         label: 'Slot Manager', icon: LayoutGrid },
      { href: '/admin/toplist',       label: 'Toplist',      icon: Trophy },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      { href: '/admin/brands',        label: 'Brands',       icon: Building2 },
      { href: '/admin/banners',       label: 'Banner Pool',  icon: ImageIcon },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { href: '/admin/tracking',      label: 'Tracking Links', icon: Link2 },
      { href: '/admin/image-domains', label: 'Image Domains',  icon: Server },
      { href: '/admin/recycle',       label: 'Recycle Bin',    icon: Trash2 },
    ],
  },
]

const COLLAPSED_KEY = 'sidebar_collapsed'

export default function Sidebar({ onOpenCommand }: { onOpenCommand?: () => void }) {
  const pathname  = usePathname()
  const [hovered, setHovered]   = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    if (stored === '1') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed(c => {
      localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      return !c
    })
  }

  const w = collapsed ? '56px' : 'var(--sidebar-w)'

  return (
    <aside style={{
      width: w, background: 'var(--bg-subtle)',
      borderRight: '1px solid var(--border)', height: '100vh',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease', overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{
        height: 'var(--topbar-h)', display: 'flex', alignItems: 'center',
        padding: '0 14px', borderBottom: '1px solid var(--border)',
        gap: '9px', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ImageIcon size={14} color="#fff" strokeWidth={2} />
        </div>
        {!collapsed && (
          <span style={{
            fontWeight: 700, fontSize: '13px', letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', color: 'var(--text)',
          }}>
            Hệ Thống Banner SEO1
          </span>
        )}
      </div>

      {/* Command trigger */}
      {!collapsed && (
        <div style={{ padding: '12px 10px 6px', flexShrink: 0 }}>
          <button
            onClick={onOpenCommand}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              height: '32px', padding: '0 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)', border: '1px solid var(--border-strong)',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12.5px',
              transition: 'border-color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          >
            <Command size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Tìm nhanh</span>
            <kbd style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
              background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)',
            }}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '8px 6px' : '6px 8px', overflowY: 'auto' }}>
        {navGroups.map(group => (
          <div key={group.label} style={{ marginBottom: collapsed ? '8px' : '14px' }}>
            {!collapsed && (
              <div style={{
                fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)',
                padding: '6px 10px 5px', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{group.label}</div>
            )}
            {collapsed && <div style={{ height: '4px' }} />}
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link key={href} href={href}
                  title={collapsed ? label : undefined}
                  onMouseEnter={() => setHovered(href)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : '9px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    height: '34px',
                    padding: collapsed ? '0' : '0 10px',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none', fontSize: '13px', marginBottom: '2px',
                    fontWeight: active ? 550 : 450,
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    background: active ? 'var(--accent-subtle)' : hovered === href ? 'var(--bg-hover)' : 'transparent',
                    transition: 'background 0.1s, color 0.1s',
                  }}
                >
                  <Icon size={16} strokeWidth={active ? 2 : 1.6} />
                  {!collapsed && label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Toggle button */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={toggle}
          title={collapsed ? 'Mở sidebar' : 'Thu sidebar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px', width: '100%', height: '32px',
            padding: collapsed ? '0' : '0 10px',
            borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '11.5px',
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Thu gọn</span></>}
        </button>
      </div>
    </aside>
  )
}
