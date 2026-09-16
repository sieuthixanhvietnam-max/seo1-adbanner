'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import CommandBar from '@/components/CommandBar'
import { ToastProvider } from '@/components/ToastProvider'

const COLLAPSED_KEY = 'sidebar_collapsed'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    if (stored === '1') setCollapsed(true)

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)

    // Listen for storage changes from Sidebar toggle
    const storageHandler = () => {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1')
    }
    window.addEventListener('storage', storageHandler)

    // Also poll since same-tab storage events don't fire
    const interval = setInterval(storageHandler, 100)

    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('storage', storageHandler)
      clearInterval(interval)
    }
  }, [])

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar onOpenCommand={() => setCmdOpen(true)} />
        <div style={{
          marginLeft: collapsed ? '56px' : 'var(--sidebar-w)',
          flex: 1,
          display: 'flex', flexDirection: 'column', minHeight: '100vh',
          transition: 'margin-left 0.2s ease',
        }}>
          {children}
        </div>
        <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </ToastProvider>
  )
}
