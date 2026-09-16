'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { brandApi } from '@/lib/api'
import type { Brand, BrandDomainHistory } from '@/lib/types'
import { ViewToggle, useViewMode } from '@/components/ui/ViewToggle'
import { Trash2, Pencil, History, Upload, Plus } from 'lucide-react'

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editBrand, setEditBrand] = useState<Brand | null>(null)
  const [form, setForm] = useState({ id: '', name: '', domain: '' })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [buttonFile, setButtonFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<BrandDomainHistory[]>([])
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulking, setBulking] = useState(false)
  const [view, setView] = useViewMode('brands')

  const load = async () => {
    setLoading(true)
    const res = await brandApi.getAll()
    if (res.success) setBrands(res.data || [])
    else flash('Không thể kết nối API!', true)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const flash = (text: string, error = false) => {
    setMsg({ text, error })
    setTimeout(() => setMsg(null), 3000)
  }

  const openCreate = () => {
    setEditBrand(null)
    setForm({ id: '', name: '', domain: '' })
    setLogoFile(null); setButtonFile(null)
    setShowForm(true)
  }

  const openEdit = (b: Brand) => {
    setEditBrand(b)
    setForm({ id: b.id, name: b.name, domain: b.domain || '' })
    setLogoFile(null); setButtonFile(null)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.id || !form.name) return flash('ID và tên là bắt buộc!', true)
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('domain', form.domain)
      if (logoFile) fd.append('logo', logoFile)
      if (buttonFile) fd.append('button_image', buttonFile)

      let res
      if (editBrand) {
        if (form.id !== editBrand.id) fd.append('newId', form.id)
        res = await brandApi.update(editBrand.id, fd)
      } else {
        fd.append('id', form.id)
        res = await brandApi.create(fd)
      }
      if (!res.success) throw new Error(res.message)
      flash(editBrand ? 'Đã cập nhật!' : 'Đã thêm brand!')
      setShowForm(false)
      load()
    } catch (e: any) {
      flash(e.message || 'Lỗi!', true)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa brand này?')) return
    let res = await brandApi.delete(id)
    if (!res.success && (res as any).slot_count) {
      if (confirm(`${res.message}\nXóa tất cả?`)) res = await brandApi.delete(id, true)
    }
    if (res.success) { flash('Đã xóa!'); load() }
    else flash(res.message || 'Lỗi!', true)
  }

  const loadHistory = async (id: string) => {
    if (showHistory === id) { setShowHistory(null); return }
    const res = await brandApi.getHistory(id)
    if (res.success) { setHistory(res.data || []); setShowHistory(id) }
  }

  const handleRollback = async (brandId: string, historyId: string) => {
    if (!confirm('Rollback về domain này?')) return
    const res = await brandApi.rollback(brandId, historyId)
    if (res.success) { flash('Đã rollback!'); load(); setShowHistory(null) }
    else flash(res.message || 'Lỗi!', true)
  }

  const handleBulkImport = async () => {
    let arr: any[]
    try {
      arr = JSON.parse(bulkJson)
      if (!Array.isArray(arr)) throw new Error('Phải là mảng JSON')
    } catch (e: any) {
      return flash('JSON không hợp lệ: ' + e.message, true)
    }
    setBulking(true)
    const res = await brandApi.bulkImport(arr)
    setBulking(false)
    if (res.success) {
      flash(res.message || 'Đã import!')
      setShowBulk(false); setBulkJson(''); load()
    } else flash(res.message || 'Lỗi import!', true)
  }

  const inp = { padding: '8px 11px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div>
      <Header title="Brands" actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ViewToggle value={view} onChange={setView} />
          <button className="btn btn-secondary" onClick={() => setShowBulk(true)}><Upload size={14} /> Import JSON</button>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Thêm brand</button>
        </div>
      } />

      {msg && (
        <div style={{ margin: '16px 28px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: msg.error ? '#FEF2F2' : '#F0FDF4', color: msg.error ? '#DC2626' : '#16A34A', border: `1px solid ${msg.error ? '#FECACA' : '#BBF7D0'}` }}>
          {msg.text}
        </div>
      )}

      <div style={{ padding: '24px 28px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : view === 'table' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 14px', fontWeight: 500, width: '52px' }}>Logo</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Tên</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>ID</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Login URL</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500 }}>Trạng thái</th>
                  <th style={{ padding: '9px 14px', fontWeight: 500, width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {brands.map(b => (
                  <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px' }}>
                      {b.logo_url ? (
                        <div className="img-frame" style={{ width: '34px', height: '34px', borderRadius: '7px', border: '1px solid var(--border)' }}><img src={b.logo_url} alt={b.name} /></div>
                      ) : (
                        <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)' }}>{b.name.charAt(0).toUpperCase()}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px 14px', fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: '8px 14px' }} className="mono">{b.id}</td>
                    <td style={{ padding: '8px 14px' }} className="mono">{b.login_url || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span className={`dot ${b.is_active ? 'dot-active' : 'dot-off'}`} /> {b.is_active ? 'Bật' : 'Tắt'}</span>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)} style={{ padding: '5px' }} title="Sửa"><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => loadHistory(b.id)} style={{ padding: '5px' }} title="Lịch sử domain"><History size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(b.id)} style={{ padding: '5px', color: 'var(--danger)' }} title="Xóa"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {brands.map(b => (
              <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.name} style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px', background: '#F8FAFC' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#2563EB' }}>
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{b.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.id}</div>
                  </div>
                  {!b.is_active && <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px' }}>Off</span>}
                </div>

                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Login URL:</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#2563EB', wordBreak: 'break-all', marginBottom: '10px' }}>
                    {b.login_url || '(chưa có domain)'}
                  </div>

                  {b.button_image && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Button:</div>
                      <img src={b.button_image} alt="button" style={{ height: '32px', objectFit: 'contain' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(b)} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}>Sửa</button>
                    <button onClick={() => loadHistory(b.id)} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}>Lịch sử domain</button>
                    <button onClick={() => handleDelete(b.id)} style={{ padding: '5px 12px', border: '1px solid #FCA5A5', borderRadius: '6px', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}>Xóa</button>
                  </div>

                  {showHistory === b.id && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#F8FAFC', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Lịch sử đổi domain</div>
                      {history.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa có</div>
                      ) : history.map(h => (
                        <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0' }}>
                          <span style={{ fontFamily: 'monospace' }}>{h.old_domain} → {h.new_domain}</span>
                          <button onClick={() => handleRollback(b.id, h.id)} style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '10px' }}>Rollback</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '480px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '15px' }}>
              {editBrand ? `Sửa: ${editBrand.name}` : 'Thêm brand'}
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>ID (slug)</label>
                <input style={inp} value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} placeholder="net88, 789, sun..." />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Tên brand</label>
                <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Net88" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Domain (đổi khi bị block)</label>
                <input style={inp} value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="https://net88vip.com/dang-nhap" />
                {form.domain && (
                  <div style={{ fontSize: '11px', color: '#2563EB', marginTop: '4px', fontFamily: 'monospace' }}>
                    → {form.domain}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Logo (tùy chọn)</label>
                <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} style={{ fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Ảnh nút bấm — cho Brand G (tùy chọn)</label>
                <input type="file" accept="image/*" onChange={e => setButtonFile(e.target.files?.[0] || null)} style={{ fontSize: '12px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '7px', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}>Hủy</button>
                <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {saving ? 'Đang lưu...' : (editBrand ? 'Cập nhật' : 'Tạo brand')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showBulk && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '560px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '15px' }}>Import brands hàng loạt (JSON)</div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Dán mảng JSON. Mỗi object cần <code>id</code>, <code>name</code>; tùy chọn <code>domain</code>.
              </div>
              <button
                onClick={() => setBulkJson(JSON.stringify([
                  { id: 'net88', name: 'Net88', domain: 'https://net88vip.com/dang-nhap' },
                  { id: '789bet', name: '789Bet', domain: 'https://789.com/dang-nhap' },
                ], null, 2))}
                style={{ alignSelf: 'flex-start', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: '#F8FAFC', cursor: 'pointer', fontSize: '11px' }}
              >Chèn ví dụ mẫu</button>
              <textarea
                value={bulkJson}
                onChange={e => setBulkJson(e.target.value)}
                placeholder='[{"id":"net88","name":"Net88","domain":"https://net88vip.com/dang-nhap"}]'
                style={{ ...inp, height: '260px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowBulk(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '7px', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}>Hủy</button>
                <button onClick={handleBulkImport} disabled={bulking} style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {bulking ? 'Đang import...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
