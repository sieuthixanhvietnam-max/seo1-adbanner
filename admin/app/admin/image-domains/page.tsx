'use client'
import { useState, useEffect } from 'react'
import { useToast } from '@/components/ToastProvider'
import Header from '@/components/Header'
import { imageDomainApi } from '@/lib/api'
import type { ImageDomain } from '@/lib/types'
import { ViewToggle, useViewMode } from '@/components/ui/ViewToggle'
import { Zap, AlertTriangle } from 'lucide-react'

export default function ImageDomainsPage() {
  const [domains, setDomains] = useState<ImageDomain[]>([])
  const [stats, setStats] = useState<any>({})
  const [generateCount, setGenerateCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useViewMode('image-domains', 'table')
  const { toast } = useToast()

  const load = () => imageDomainApi.getAll().then(r => {
    if (r.success) { setDomains(r.data || []); setStats(r.stats || {}) }
  })
  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setLoading(true)
    const r = await imageDomainApi.generate(generateCount)
    if (r.success) { toast(r.message || 'Đã tạo domains', 'success'); load() }
    else toast(r.message || 'Tạo thất bại', 'error')
    setLoading(false)
  }

  const handleBlock = async (d: ImageDomain) => {
    await imageDomainApi.update(d.id, { is_blocked: !d.is_blocked })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa domain này?')) return
    await imageDomainApi.delete(id)
    load()
  }

  const statusColor = (d: ImageDomain) => {
    if (d.is_blocked) return '#EF4444'
    if (!d.is_active) return '#94A3B8'
    if (d.assigned_to) return '#10B981'
    return '#F59E0B'
  }
  const statusLabel = (d: ImageDomain) => {
    if (d.is_blocked) return 'Blocked'
    if (!d.is_active) return 'Inactive'
    if (d.assigned_to) return 'Used'
    return 'Free'
  }

  return (
    <div>
      <Header title="Image Domains" actions={<ViewToggle value={view} onChange={setView} />} />
      <div style={{ padding: '24px 28px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total', value: stats.total || 0, color: '#2563EB' },
            { label: 'Available', value: stats.available || 0, color: '#10B981' },
            { label: 'Used', value: stats.used || 0, color: '#6366F1' },
            { label: 'Blocked', value: stats.blocked || 0, color: '#EF4444' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', background: '#fff' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Generate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '14px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Generate domains:</span>
          <input type="number" value={generateCount} onChange={e => setGenerateCount(+e.target.value)} min={1} max={100}
            style={{ width: '70px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }} />
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            <Zap size={14} /> {loading ? 'Đang tạo...' : 'Generate'}
          </button>
          {(stats.available || 0) < 10 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--warn)', fontWeight: 600 }}><AlertTriangle size={13} /> Pool sắp hết! ({stats.available} còn lại)</span>
          )}
        </div>

        {view === 'cards' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {domains.map(d => (
              <div key={d.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                  <span className="mono" style={{ color: d.is_blocked ? 'var(--text-muted)' : 'var(--text)', textDecoration: d.is_blocked ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.base_url}</span>
                  <span className="chip" style={{ background: statusColor(d) + '15', color: statusColor(d), flexShrink: 0 }}>{statusLabel(d)}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Gán: {d.site_name || d.assigned_to || '—'}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleBlock(d)} style={{ color: d.is_blocked ? 'var(--success)' : 'var(--danger)' }}>{d.is_blocked ? 'Unblock' : 'Block'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(d.id)} style={{ color: 'var(--danger)' }}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                {['Domain', 'Status', 'Gán cho site', 'Tạo lúc', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < domains.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: d.is_blocked ? '#94A3B8' : 'var(--text)', textDecoration: d.is_blocked ? 'line-through' : 'none' }}>
                    {d.base_url}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 8px', background: statusColor(d) + '15', color: statusColor(d), borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                      {statusLabel(d)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                    {d.site_name || d.assigned_to || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {d.created_at ? new Date(d.created_at).toLocaleDateString('vi') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleBlock(d)}
                        style={{ padding: '4px 10px', border: `1px solid ${d.is_blocked ? '#86EFAC' : '#FCA5A5'}`, borderRadius: '5px', background: 'transparent', color: d.is_blocked ? '#16A34A' : '#EF4444', cursor: 'pointer', fontSize: '11px' }}>
                        {d.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button onClick={() => handleDelete(d.id)}
                        style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '5px', background: 'transparent', cursor: 'pointer', fontSize: '11px' }}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
