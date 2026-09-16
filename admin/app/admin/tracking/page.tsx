'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import { trackingApi } from '@/lib/api'
import { RefreshCw, Link2, Trash2, Search, Copy, Check, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ToastProvider'

interface TrackingRow {
  domain: string
  brand_id: string
  track_url: string
  updated_at: string
}

interface SyncStatus {
  last_sync: string | null
  row_count: number
  sheet_url: string | null
  last_sync_rows: number
}

export default function TrackingPage() {
  const [status, setStatus]           = useState<SyncStatus | null>(null)
  const [rows, setRows]               = useState<TrackingRow[]>([])
  const [total, setTotal]             = useState(0)
  const [sheetUrl, setSheetUrl]       = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterBrand, setFilterBrand]   = useState('')
  const { toast } = useToast()
  const [syncing, setSyncing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [copiedKey, setCopiedKey]     = useState<string | null>(null)
  const filterRef                     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const LIMIT = 100

  const loadStatus = async () => {
    const r = await trackingApi.getStatus()
    if (r.success) {
      setStatus(r.data)
      if (r.data.sheet_url) setSheetUrl(r.data.sheet_url)
    }
  }

  const loadRows = async (p = page, domain = filterDomain, brand = filterBrand) => {
    const params: any = { page: p, limit: LIMIT }
    if (domain) params.domain = domain
    if (brand) params.brand_id = brand
    const r = await trackingApi.getAll(params)
    if (r.success) { setRows(r.data || []); setTotal(r.total || 0) }
  }

  useEffect(() => {
    Promise.all([loadStatus(), loadRows(1)]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    clearTimeout(filterRef.current)
    filterRef.current = setTimeout(() => { setPage(1); loadRows(1, filterDomain, filterBrand) }, 350)
  }, [filterDomain, filterBrand])

  const handleSaveUrl = async () => {
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      return toast('URL phải là Google Sheet (docs.google.com/spreadsheets/...)', 'error')
    }
    setSaving(true)
    const r = await trackingApi.saveSheetUrl(sheetUrl)
    setSaving(false)
    toast(r.success ? 'Đã lưu Sheet URL' : (r.message || 'Lỗi lưu URL'), r.success ? 'success' : 'error')
    if (r.success) loadStatus()
  }

  const handleSync = async () => {
    setSyncing(true)
    const r = await trackingApi.sync()
    setSyncing(false)
    toast(r.success ? (r.message || 'Sync thành công') : (r.message || 'Lỗi sync'), r.success ? 'success' : 'error')
    if (r.success) { loadStatus(); loadRows(1) }
  }

  const handleDelete = async (domain: string, brand_id?: string) => {
    const label = brand_id ? `${brand_id} / ${domain}` : `toàn bộ ${domain}`
    if (!confirm(`Xóa tracking ${label}?`)) return
    const r = await trackingApi.delete(domain, brand_id)
    if (r.success) { toast('Đã xóa', 'success'); loadRows(page); loadStatus() }
    else toast('Xóa thất bại', 'error')
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div>
      <Header title="Tracking Links" actions={
        <button className="btn btn-primary" onClick={handleSync} disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
          {syncing ? 'Đang sync...' : 'Sync từ Sheet'}
        </button>
      } />

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Tổng tracking links', value: status?.row_count ?? '—', color: 'var(--accent)' },
            { label: 'Sync lần cuối', value: fmtDate(status?.last_sync ?? null), color: 'var(--text)', small: true },
            { label: 'Rows lần sync cuối', value: status?.last_sync_rows || '—', color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: s.small ? 14 : 24, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Sheet URL config ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={15} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Google Sheet CSV</span>
            {status?.sheet_url && (
              <a href={status.sheet_url} target="_blank" rel="noopener" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                Xem Sheet <ExternalLink size={11} />
              </a>
            )}
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
              Google Sheet → <strong>File → Share → Publish to web</strong> → Chọn sheet → <strong>CSV</strong> → Publish → Copy link
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={handleSaveUrl} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                {saving ? 'Đang lưu...' : 'Lưu URL'}
              </button>
            </div>
          </div>

          {/* Format guide */}
          <div style={{ margin: '0 20px 20px', padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Format sheet — 3 cột, row 1 là header
            </div>
            <table style={{ fontSize: 12, fontFamily: 'var(--font-mono)', borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--border)' }}>
                  {['domain', 'brand_id', 'tracking_url'].map(h => (
                    <th key={h} style={{ padding: '4px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['moto88.ru.com', 'net88', 'https://net88.com/go?aff=moto88_001'],
                  ['moto88.ru.com', 'gem88', 'https://gem88.com/go?aff=moto88_x'],
                  ['debet88.com.co', 'net88', 'https://net88.com/go?aff=debet_007'],
                ].map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '3px 10px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              domain: không có www. / https:// &nbsp;·&nbsp; brand_id: khớp chính xác &nbsp;·&nbsp; tracking_url: URL đầy đủ từ nhà cái
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Filter bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-subtle)' }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              className="input"
              style={{ width: 220, fontSize: 13, padding: '6px 10px' }}
              placeholder="Lọc theo domain..."
              value={filterDomain}
              onChange={e => setFilterDomain(e.target.value)}
            />
            <input
              className="input"
              style={{ width: 150, fontSize: 13, padding: '6px 10px' }}
              placeholder="Lọc brand_id..."
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
            />
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {total.toLocaleString()} links
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Đang tải...</div>
          ) : rows.length === 0 ? (
            <div className="empty" style={{ padding: '56px 20px' }}>
              <div className="empty-icon"><Link2 size={28} /></div>
              <p>{filterDomain || filterBrand ? 'Không tìm thấy kết quả.' : 'Chưa có tracking link. Sync từ Google Sheet để bắt đầu.'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 16px', fontWeight: 500, width: 200 }}>Domain</th>
                  <th style={{ padding: '9px 16px', fontWeight: 500, width: 110 }}>Brand</th>
                  <th style={{ padding: '9px 16px', fontWeight: 500 }}>Tracking URL</th>
                  <th style={{ padding: '9px 16px', fontWeight: 500, width: 150 }}>Cập nhật</th>
                  <th style={{ padding: '9px 16px', width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const copyKey = `${r.domain}:${r.brand_id}`
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 16px' }}>
                        <code style={{ fontSize: 12, color: 'var(--text)', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{r.domain}</code>
                      </td>
                      <td style={{ padding: '9px 16px' }}>
                        <span className="chip">{r.brand_id}</span>
                      </td>
                      <td style={{ padding: '9px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', flex: 1 }}>{r.track_url}</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleCopy(r.track_url, copyKey)}
                            title="Copy URL"
                            style={{ flexShrink: 0, color: copiedKey === copyKey ? '#16a34a' : undefined }}
                          >
                            {copiedKey === copyKey ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '9px 16px', fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(r.updated_at)}</td>
                      <td style={{ padding: '9px 16px' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(r.domain, r.brand_id)}
                          title="Xóa"
                          style={{ padding: '4px', color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); loadRows(p) }}>Trước</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>
                Trang {page} / {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); loadRows(p) }}>Sau</button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
