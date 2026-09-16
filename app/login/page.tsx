'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ChevronDown, ArrowRight, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiUrl, setApiUrl] = useState('http://localhost:3001')
  const [showApiConfig, setShowApiConfig] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('api_url')
    // localhost:3000 is the admin's own port — never a valid backend URL, so ignore stale values
    if (stored && stored !== 'http://localhost:3000') setApiUrl(stored)
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
      localStorage.setItem('admin_token', data.token)
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
      document.cookie = `admin_token=${data.token}; expires=${expires}; path=/`
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
      {/* Subtle grid backdrop */}
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
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={17} color="#fff" fill="#fff" strokeWidth={0} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' }}>AdBanner</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Bảng điều khiển quản trị</div>
          </div>
        </div>

        <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '4px' }}>Đăng nhập</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '22px' }}>Nhập mật khẩu quản trị để tiếp tục.</div>

        <div style={{ marginBottom: '12px' }}>
          <label className="label">Mật khẩu</label>
          <input
            ref={inputRef} className="input" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
          />
        </div>

        {/* API config */}
        <div style={{ marginBottom: '16px' }}>
          <button type="button" onClick={() => setShowApiConfig(!showApiConfig)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', padding: 0 }}>
            <ChevronDown size={13} style={{ transform: showApiConfig ? 'none' : 'rotate(-90deg)', transition: '0.15s' }} />
            Cấu hình API URL
          </button>
          {showApiConfig && (
            <input className="input mono" style={{ marginTop: '8px' }} value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:3001" />
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', marginBottom: '14px', background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--danger)' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleLogin} disabled={loading || !password} style={{ width: '100%', height: '38px', justifyContent: 'center' }}>
          {loading ? 'Đang đăng nhập...' : <>Đăng nhập <ArrowRight size={15} /></>}
        </button>
      </div>
    </div>
  )
}
