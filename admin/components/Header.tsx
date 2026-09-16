'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Check, LogOut, Eye, EyeOff } from 'lucide-react'
import { getBaseUrl } from '@/lib/api'

export default function Header({ title, actions }: {
  title: string
  actions?: React.ReactNode
}) {
  const [token, setToken] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Đọc token từ cookie (không dùng localStorage để tránh XSS)
    const cookieToken = document.cookie.match(/(?:^|;\s*)admin_token=([^;]*)/)
    setToken(cookieToken ? decodeURIComponent(cookieToken[1]) : '')
    setApiUrl(localStorage.getItem('api_url') || 'http://localhost:3001')
    // ping health
    fetch(`${getBaseUrl()}/health`).then(r => setOnline(r.ok)).catch(() => setOnline(false))
  }, [])

  const logout = () => {
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
    router.push('/login')
  }

  const save = () => {
    // Lưu token vào cookie, api_url vào localStorage
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
    const secure = location.protocol === 'https:' ? '; Secure; SameSite=Strict' : '; SameSite=Lax'
    document.cookie = `admin_token=${encodeURIComponent(token)}; expires=${expires}; path=/${secure}`
    localStorage.setItem('api_url', apiUrl)
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowSettings(false); window.location.reload() }, 800)
  }

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', flexShrink: 0,
    border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-secondary)',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  }

  return (
    <header style={{
      minHeight: 'var(--topbar-h)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      padding: '10px 20px', background: 'var(--bg)',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>{title}</h1>
        {online !== null && (
          <span title={online ? 'Đã kết nối API' : 'Mất kết nối API'} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 500, color: online ? 'var(--success)' : 'var(--danger)',
            padding: '3px 8px', borderRadius: '999px',
            background: online ? 'var(--success-subtle)' : 'var(--danger-subtle)',
          }}>
            <span className={`dot ${online ? 'dot-active' : 'dot-danger'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', justifyContent: 'flex-end', minWidth: 0 }}>
        {actions}
        <div style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
        <button style={iconBtn} title="Cài đặt kết nối" onClick={() => setShowSettings(true)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
          <Settings size={15} />
        </button>
        <button style={iconBtn} title="Đăng xuất" onClick={logout}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-subtle)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger-border)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}>
          <LogOut size={15} />
        </button>
      </div>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" style={{ width: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              Kết nối API
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(false)} style={{ padding: '4px' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">API URL</label>
                <input className="input mono" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:3001" />
              </div>
              <div>
                <label className="label">Admin Token</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input mono"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    readOnly
                    placeholder="••••••••"
                    style={{ paddingRight: '36px', cursor: 'default' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 0, display: 'flex',
                    }}
                    title={showToken ? 'Ẩn token' : 'Hiện token'}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>
                {saved ? <><Check size={14} /> Đã lưu</> : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
