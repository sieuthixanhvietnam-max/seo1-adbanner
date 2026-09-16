'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { siteApi, getBaseUrl, jsonHeaders } from '@/lib/api'
import type { Site } from '@/lib/types'
import { PLACEMENT_COLORS } from '@/lib/types'
import { Select } from '@/components/ui/Select'
import { ViewToggle, useViewMode } from '@/components/ui/ViewToggle'
import { Plus, Globe, Pencil, Trash2, Image as ImageIcon, Upload } from 'lucide-react'

const BULK_SAMPLE = JSON.stringify([
  {
    id: 'nganh-g',
    name: 'Ngành G',
    domain: 'nganh-g.com',
    placements: {
      catfish: { label: 'Catfish', limit: 4, default_mode: 'rotate' },
      button:  { label: 'Nút bấm', limit: 2, default_mode: 'fixed' },
      popup:   { label: 'Popup',   limit: 1, default_mode: 'fixed' },
    },
  },
], null, 2)

const TEMPLATES: Record<string, any> = {
  'nganh': {
    catfish: { label: 'Catfish', limit: 4, default_mode: 'rotate' },
    button:  { label: 'Nút bấm', limit: 2, default_mode: 'fixed' },
    popup:   { label: 'Popup',   limit: 1, default_mode: 'fixed' },
  },
  'phishing': {
    slider:  { label: 'Slider',  limit: 10, default_mode: 'rotate' },
    catfish: { label: 'Catfish', limit: 4,  default_mode: 'rotate' },
    button:  { label: 'Nút bấm', limit: 2,  default_mode: 'fixed' },
    popup:   { label: 'Popup',   limit: 1,  default_mode: 'fixed' },
  },
  'brand': { 'brand-button': { label: 'Brand Button', limit: 0, default_mode: 'fixed' } },
}

const MODE_OPTS = [{ value: 'fixed', label: 'Fixed' }, { value: 'rotate', label: 'Rotate' }]

interface PRow { key: string; label: string; limit: number; default_mode: string }

const placementsToRows = (obj: Record<string, any>): PRow[] =>
  Object.entries(obj || {}).map(([key, cfg]) => ({
    key, label: cfg.label || '', limit: cfg.limit ?? 0, default_mode: cfg.default_mode || 'fixed',
  }))

const rowsToPlacements = (rows: PRow[]): Record<string, any> => {
  const out: Record<string, any> = {}
  rows.forEach(r => {
    const k = r.key.trim()
    if (!k) return
    out[k] = { label: r.label || k, limit: Number(r.limit) || 0, default_mode: r.default_mode }
  })
  return out
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [view, setView] = useViewMode('sites')
  const [showForm, setShowForm] = useState(false)
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [form, setForm] = useState({ id: '', name: '', domain: '', site_type: '', template: 'nganh', placements: '' })
  const [pmode, setPmode] = useState<'manual' | 'json'>('manual')  // chế độ điền placements
  const [rows, setRows] = useState<PRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulking, setBulking] = useState(false)

  const load = () => siteApi.getAll().then(r => { if (r.success) setSites(r.data || []) })
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditSite(null); setPmode('manual')
    setForm({ id: '', name: '', domain: '', site_type: '', template: 'nganh', placements: JSON.stringify(TEMPLATES['nganh'], null, 2) })
    setRows(placementsToRows(TEMPLATES['nganh']))
    setShowForm(true)
  }
  const openEdit = (s: Site) => {
    setEditSite(s); setPmode('manual')
    setForm({ id: s.id, name: s.name, domain: (s as any).domain || '', site_type: (s as any).site_type || '', template: '', placements: JSON.stringify(s.placements, null, 2) })
    setRows(placementsToRows(s.placements as any))
    setShowForm(true)
  }
  const setTemplate = (t: string) => {
    setForm(f => ({ ...f, template: t, placements: JSON.stringify(TEMPLATES[t] || {}, null, 2) }))
    setRows(placementsToRows(TEMPLATES[t] || {}))
  }

  // Chuyển tab: đồng bộ dữ liệu giữa builder ↔ JSON
  const switchMode = (m: 'manual' | 'json') => {
    if (m === pmode) return
    if (m === 'json') {
      setForm(f => ({ ...f, placements: JSON.stringify(rowsToPlacements(rows), null, 2) }))
    } else {
      try { setRows(placementsToRows(JSON.parse(form.placements))) }
      catch { alert('JSON hiện không hợp lệ — không thể chuyển sang thủ công.'); return }
    }
    setPmode(m)
  }

  const addRow = () => setRows(r => [...r, { key: '', label: '', limit: 1, default_mode: 'fixed' }])
  const updateRow = (i: number, patch: Partial<PRow>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i))

  const submit = async () => {
    let placements: Record<string, any>
    if (pmode === 'manual') {
      placements = rowsToPlacements(rows)
      if (Object.keys(placements).length === 0) return alert('Cần ít nhất 1 placement.')
    } else {
      try { placements = JSON.parse(form.placements) }
      catch { return alert('Placements JSON không hợp lệ') }
    }
    setLoading(true)
    try {
      const res = editSite
        ? await siteApi.update(editSite.id, { name: form.name, domain: form.domain, site_type: form.site_type, placements })
        : await siteApi.create({ id: form.id, name: form.name, domain: form.domain, site_type: form.site_type, placements })
      if (res.success) { setShowForm(false); load() } else alert(res.message)
    } finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Xóa site này? Toàn bộ slots sẽ bị xóa.')) return
    await siteApi.delete(id); load()
  }

  const handleBulkImport = async () => {
    let arr: any[]
    try {
      arr = JSON.parse(bulkJson)
      if (!Array.isArray(arr)) throw new Error('Phải là mảng JSON')
    } catch (e: any) {
      return alert('JSON không hợp lệ: ' + e.message)
    }
    setBulking(true)
    try {
      const res = await fetch(`${getBaseUrl()}/api/sites/bulk`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ sites: arr }),
      }).then(r => r.json())
      if (res.success) {
        alert(res.message || 'Đã import!')
        setShowBulk(false); setBulkJson(''); load()
      } else alert(res.message || 'Lỗi import!')
    } catch (e: any) {
      alert(e.message || 'Lỗi import!')
    } finally {
      setBulking(false)
    }
  }

  return (
    <div>
      <Header title="Sites" actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ViewToggle value={view} onChange={setView} />
          <button className="btn btn-secondary" onClick={() => setShowBulk(true)}><Upload size={14} /> Import JSON</button>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Thêm site</button>
        </div>
      } />
      <div style={{ padding: '20px 24px' }} className="fade-in">
        {sites.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Globe size={20} /></div>
            <div style={{ fontSize: '14px', fontWeight: 550, color: 'var(--text-secondary)' }}>Chưa có site nào</div>
            <div style={{ marginTop: '4px' }}>Tạo site đầu tiên để bắt đầu cấu hình banner.</div>
          </div>
        ) : view === 'table' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Tên</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>ID</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Domain</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Placements</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Trạng thái</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500, width: '90px' }}></th>
                </tr>
              </thead>
              <tbody>
                {sites.map(site => (
                  <tr key={site.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 600 }}>{site.name}</td>
                    <td style={{ padding: '8px 14px' }} className="mono">{site.id}</td>
                    <td style={{ padding: '8px 14px' }} className="mono">{(site as any).domain || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Object.entries(site.placements || {}).map(([p, cfg]) => {
                          const c = PLACEMENT_COLORS[p] || '#71717A'
                          return <span key={p} className="chip" style={{ background: c + '14', color: c }}>{cfg.label} · {cfg.limit}</span>
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span className={`dot ${site.is_active ? 'dot-active' : 'dot-off'}`} /> {site.is_active ? 'Bật' : 'Tắt'}</span>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(site)} style={{ padding: '5px' }} title="Sửa"><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => remove(site.id)} style={{ padding: '5px', color: 'var(--danger)' }} title="Xóa"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {sites.map(site => (
              <div key={site.id} className="card">
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`dot ${site.is_active ? 'dot-active' : 'dot-off'}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{site.name}</div>
                    <div className="mono" style={{ color: 'var(--text-muted)' }}>{site.id}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(site)} style={{ padding: '5px' }}><Pencil size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(site.id)} style={{ padding: '5px', color: 'var(--danger)' }}><Trash2 size={13} /></button>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {Object.entries(site.placements || {}).map(([p, cfg]) => {
                    const c = PLACEMENT_COLORS[p] || '#71717A'
                    return (
                      <span key={p} className="chip" style={{ background: c + '14', color: c }}>
                        {cfg.label} · {cfg.limit}
                      </span>
                    )
                  })}
                </div>
                {(site as any).domain && (
                  <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <ImageIcon size={12} /> <span className="mono">{(site as any).domain}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: '560px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">{editSite ? `Sửa site` : 'Thêm site mới'}<button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!editSite && (
                <div><label className="label">ID (slug)</label><input className="input mono" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} placeholder="nganh-g" /></div>
              )}
              <div><label className="label">Tên site</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ngành G" /></div>
              <div><label className="label">Domain WordPress (tùy chọn)</label><input className="input mono" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="nganh-g.com" /></div>
              <div><label className="label">Site Type (tùy chọn)</label><input className="input mono" value={form.site_type} onChange={e => setForm(f => ({ ...f, site_type: e.target.value }))} placeholder="nganh-g" /></div>

              {!editSite && (
                <div>
                  <label className="label">Template nhanh</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Object.keys(TEMPLATES).map(t => (
                      <button key={t} onClick={() => setTemplate(t)} className={form.template === t ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} style={{ textTransform: 'capitalize' }}>{t}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chế độ điền placements: Thủ công ↔ JSON */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="label" style={{ margin: 0 }}>Placements</label>
                  <div style={{ display: 'inline-flex', gap: '2px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {(['manual', 'json'] as const).map(m => (
                      <button key={m} type="button" onClick={() => switchMode(m)}
                        style={{ height: '24px', padding: '0 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
                          fontWeight: pmode === m ? 550 : 450, background: pmode === m ? 'var(--bg)' : 'transparent',
                          color: pmode === m ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: pmode === m ? 'var(--shadow-sm)' : 'none' }}>
                        {m === 'manual' ? 'Thủ công' : 'JSON'}
                      </button>
                    ))}
                  </div>
                </div>

                {pmode === 'manual' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Header cột */}
                    {rows.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 64px 104px 30px', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', padding: '0 2px' }}>
                        <span>Key</span><span>Nhãn</span><span>Limit</span><span>Chế độ</span><span></span>
                      </div>
                    )}
                    {rows.map((row, i) => {
                      const c = PLACEMENT_COLORS[row.key] || '#71717A'
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 64px 104px 30px', gap: '6px', alignItems: 'center' }}>
                          <input className="input mono" style={{ height: '32px', borderLeft: `3px solid ${c}` }} value={row.key} onChange={e => updateRow(i, { key: e.target.value })} placeholder="catfish" />
                          <input className="input" style={{ height: '32px' }} value={row.label} onChange={e => updateRow(i, { label: e.target.value })} placeholder="Catfish" />
                          <input className="input" style={{ height: '32px' }} type="number" min={0} value={row.limit} onChange={e => updateRow(i, { limit: +e.target.value })} />
                          <Select value={row.default_mode} onChange={v => updateRow(i, { default_mode: v })} options={MODE_OPTS} size="sm" minWidth={104} />
                          <button className="btn btn-ghost btn-sm" onClick={() => removeRow(i)} style={{ padding: '4px', color: 'var(--danger)' }} title="Xóa dòng"><Trash2 size={13} /></button>
                        </div>
                      )
                    })}
                    <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addRow}><Plus size={13} /> Thêm placement</button>
                  </div>
                ) : (
                  <textarea className="input mono" style={{ height: '210px', resize: 'vertical' }} value={form.placements} onChange={e => setForm(f => ({ ...f, placements: e.target.value }))} />
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Đang lưu...' : editSite ? 'Cập nhật' : 'Tạo site'}</button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="modal-overlay" onClick={() => setShowBulk(false)}>
          <div className="modal" style={{ width: '560px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">Import sites (JSON)<button className="btn btn-ghost btn-sm" onClick={() => setShowBulk(false)}>✕</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Dán mảng JSON. Mỗi object cần <span className="mono">id</span>, <span className="mono">name</span>, <span className="mono">placements</span>; tùy chọn <span className="mono">domain</span>, <span className="mono">sort_order</span>. Site đã tồn tại sẽ được bỏ qua.
              </div>
              <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setBulkJson(BULK_SAMPLE)}>Chèn ví dụ mẫu</button>
              <div>
                <label className="label">Sites (JSON)</label>
                <textarea
                  className="input mono"
                  style={{ height: '280px', resize: 'vertical' }}
                  value={bulkJson}
                  onChange={e => setBulkJson(e.target.value)}
                  placeholder='[{"id":"nganh-g","name":"Ngành G","placements":{"button":{"label":"Nút bấm","limit":2,"default_mode":"fixed"}}}]'
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulk(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleBulkImport} disabled={bulking}>{bulking ? 'Đang import...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
