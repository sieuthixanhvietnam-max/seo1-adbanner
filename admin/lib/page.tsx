'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, ChevronDown, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react'

function getDefaultApiUrl() {
  if (typeof window === 'undefined') return ''
  const { protocol, hostname, port } = window.location
  // Production: same origin (OLS proxy → backend)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return window.location.origin
  // Local dev
  return 'http://localhost:4001'
}

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiUrl, setApiUrl] = useState('')
  const [showApiConfig, setShowApiConfig] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('api_url')
    const defaultUrl = getDefaultApiUrl()
    // Ignore stale localhost:3000 (admin's own port)
    if (stored && stored !== 'http://localhost:3000' && stored !== 'http://localhost:3001') {
      setApiUrl(stored)
    } else {
      setApiUrl(defaultUrl)
    }
    inputRef.current?.focus()
  }, [])

  const handleLogin = async () => {
    if (!password) return
    setLoading(true); setError('')
    try {
      localStorage.setItem('api_url', apiUrl)
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Sai mật khẩu')
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
      const secure = location.protocol === 'https:' ? '; Secure; SameSite=Strict' : '; SameSite=Lax'
      document.cookie = `admin_token=${encodeURIComponent(data.token)}; expires=${expires}; path=/${secure}`
      router.push('/admin')
    } catch (e: any) {
      setError(e.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-subtle)', padding: '20px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 0)',
        backgroundSize: '28px 28px',
      }} />

      <div className="fade-in" style={{
        width: '380px', background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: '32px', position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ImageIcon size={17} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Hệ Thống Banner SEO1</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Bảng điều khiển quản trị</div>
          </div>
        </div>

        <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '4px' }}>Đăng nhập</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '22px' }}>Nhập mật khẩu quản trị để tiếp tục.</div>

        <div style={{ marginBottom: '12px' }}>
          <label className="label">Mật khẩu</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef} className="input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={{ paddingRight: '36px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex',
              }}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* API config — ẩn mặc định, chỉ cần khi dev hoặc đổi server */}
        <div style={{ marginBottom: '16px' }}>
          <button type="button" onClick={() => setShowApiConfig(!showApiConfig)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', padding: 0 }}>
            <ChevronDown size={13} style={{ transform: showApiConfig ? 'none' : 'rotate(-90deg)', transition: '0.15s' }} />
            Cấu hình API URL
          </button>
          {showApiConfig && (
            <input
              className="input mono" style={{ marginTop: '8px' }}
              value={apiUrl} onChange={e => setApiUrl(e.target.value)}
              placeholder="https://banners.aeseo1.com"
            />
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', marginBottom: '14px', background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--danger)' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleLogin} disabled={loading || !password}
          style={{ width: '100%', height: '38px', justifyContent: 'center' }}>
          {loading ? 'Đang đăng nhập...' : <>Đăng nhập <ArrowRight size={15} /></>}
        </button>
      </div>
    </div>
  )
}
