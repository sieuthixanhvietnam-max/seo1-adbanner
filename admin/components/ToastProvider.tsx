'use client'
import { createContext, useContext, useCallback, useRef, useState } from 'react'
import { Check, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  text: string
}

interface ToastCtx {
  toast: (text: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

const COLORS: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  error:   { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  info:    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <Check size={15} />,
  error:   <AlertCircle size={15} />,
  info:    <Info size={15} />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, type, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none',
        }}>
          {toasts.map(t => {
            const c = COLORS[t.type]
            return (
              <div key={t.id} className="fade-in" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px 11px 16px',
                borderRadius: 10, fontSize: 13, fontWeight: 500,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                background: c.bg, color: c.text,
                border: `1px solid ${c.border}`,
                minWidth: 260, maxWidth: 400,
                pointerEvents: 'all',
              }}>
                {ICONS[t.type]}
                <span style={{ flex: 1, lineHeight: 1.4 }}>{t.text}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, opacity: 0.6, padding: 2, display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Ctx.Provider>
  )
}
