'use client'
import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { bannerApi, brandApi } from '@/lib/api'
import type { Banner, Brand } from '@/lib/types'
import { PLACEMENT_COLORS, PLACEMENT_ICONS } from '@/lib/types'
import { PlacementIcon } from '@/lib/icons'
import { Select, type SelectOption } from '@/components/ui/Select'
import { ViewToggle, useViewMode } from '@/components/ui/ViewToggle'
import { Upload, ImageOff, Trash2, Maximize2, X } from 'lucide-react'

const PLACEMENTS = ['catfish', 'button', 'popup', 'slider', 'brand-button']

const fmtSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

  const [filterPlacement, setFilterPlacement] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [preview, setPreview] = useState<Banner | null>(null)

  const [view, setView] = useViewMode('banners')
  const [showUpload, setShowUpload] = useState(false)
  const [upForm, setUpForm] = useState({ brand_id: '', placement: 'catfish', title: '', click_url: '' })
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    const params: any = {}
    if (filterPlacement) params.placement = filterPlacement
    if (filterBrand) params.brand_id = filterBrand
    const [bRes, brRes] = await Promise.all([bannerApi.getAll(params), brandApi.getAll()])
    if (bRes.success) setBanners(bRes.data || [])
    if (brRes.success) setBrands(brRes.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filterPlacement, filterBrand])

  const brandName = (id?: string) => brands.find(b => b.id === id)?.name || id || ''

  const placementOpt = (p: string): SelectOption => ({
    value: p, label: p,
    icon: <PlacementIcon name={PLACEMENT_ICONS[p] || ''} size={14} color={PLACEMENT_COLORS[p] || '#71717A'} />,
  })
  const filterPlacementOpts: SelectOption[] = [{ value: '', label: 'Tất cả vị trí' }, ...PLACEMENTS.map(placementOpt)]
  const filterBrandOpts: SelectOption[] = [{ value: '', label: 'Tất cả brand' }, ...brands.map(b => ({ value: b.id, label: b.name }))]
  const uploadPlacementOpts: SelectOption[] = PLACEMENTS.map(placementOpt)
  const uploadBrandOpts: SelectOption[] = [{ value: '', label: '— Không gắn brand —' }, ...brands.map(b => ({ value: b.id, label: b.name }))]

  // Gom banner theo placement để hiển thị trực quan theo nhóm
  const groups = useMemo(() => {
    const map = new Map<string, Banner[]>()
    banners.forEach(b => {
      const arr = map.get(b.placement) || []
      arr.push(b); map.set(b.placement, arr)
    })
    const order = [...PLACEMENTS, ...Array.from(map.keys()).filter(p => !PLACEMENTS.includes(p))]
    return order.filter(p => map.has(p)).map(p => ({ placement: p, items: map.get(p)! }))
  }, [banners])

  const flash = (text: string, error = false) => {
    setMsg({ text, error }); setTimeout(() => setMsg(null), 3500)
  }

  const handleUpload = async () => {
    if (!files.length) return flash('Chọn ít nhất 1 ảnh!', true)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('placement', upForm.placement)
      if (upForm.brand_id) fd.append('brand_id', upForm.brand_id)
      if (upForm.title) fd.append('title', upForm.title)
      if (upForm.click_url) fd.append('click_url', upForm.click_url)
      files.forEach(f => fd.append('images', f))

      const res = await bannerApi.upload(fd)
      if (!res.success) throw new Error(res.message)
      const { inserted, duplicates } = res.data
      let m = `Đã upload ${inserted.length} banner`
      if (duplicates?.length) m += `, ${duplicates.length} trùng bị bỏ qua`
      flash(m)
      setShowUpload(false); setFiles([])
      setUpForm({ brand_id: '', placement: 'catfish', title: '', click_url: '' })
      load()
    } catch (e: any) {
      flash(e.message || 'Lỗi upload!', true)
    } finally {
      setUploading(false)
    }
  }

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    const imgs = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...imgs])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false)
    addFiles(e.dataTransfer.files)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa banner này? (chuyển vào Recycle Bin)')) return
    const res = await bannerApi.delete(id)
    if (res.success) {
      flash(res.detached_slots?.length ? `Đã xóa, gỡ khỏi ${res.detached_slots.length} slot` : 'Đã xóa!')
      load()
    } else flash(res.message || 'Lỗi!', true)
  }

  return (
    <div>
      <Header title="Banner Pool" actions={
        <>
          <Select value={filterPlacement} onChange={setFilterPlacement} options={filterPlacementOpts} minWidth={150} size="sm" />
          <Select value={filterBrand} onChange={setFilterBrand} options={filterBrandOpts} minWidth={150} size="sm" />
          <ViewToggle value={view} onChange={setView} />
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}><Upload size={14} /> Upload banner</button>
        </>
      } />

      {msg && (
        <div style={{ margin: '16px 24px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: msg.error ? 'var(--danger-subtle)' : '#F0FDF4', color: msg.error ? 'var(--danger)' : '#16A34A', border: `1px solid ${msg.error ? 'var(--danger-border)' : '#BBF7D0'}` }}>
          {msg.text}
        </div>
      )}

      <div style={{ padding: '20px 24px' }} className="fade-in">
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{banners.length} banner</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : banners.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><ImageOff size={20} /></div>
            <div style={{ fontSize: '14px', fontWeight: 550, color: 'var(--text-secondary)' }}>Chưa có banner</div>
            <div style={{ marginTop: '4px' }}>Upload ảnh để bắt đầu xây pool banner.</div>
          </div>
        ) : view === 'table' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 12px', fontWeight: 500, width: '72px' }}>Ảnh</th>
                  <th style={{ padding: '9px 12px', fontWeight: 500 }}>Vị trí</th>
                  <th style={{ padding: '9px 12px', fontWeight: 500 }}>Brand</th>
                  <th style={{ padding: '9px 12px', fontWeight: 500 }}>Kích thước</th>
                  <th style={{ padding: '9px 12px', fontWeight: 500 }}>Trạng thái</th>
                  <th style={{ padding: '9px 12px', fontWeight: 500, width: '48px' }}></th>
                </tr>
              </thead>
              <tbody>
                {banners.map(b => {
                  const color = PLACEMENT_COLORS[b.placement] || '#71717A'
                  return (
                    <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div className="img-frame" onClick={() => b.image_url && setPreview(b)} style={{ width: '52px', height: '34px', borderRadius: '5px', border: '1px solid var(--border)', cursor: b.image_url ? 'zoom-in' : 'default' }}>
                          {b.image_url ? <img src={b.image_url} alt={b.title} /> : <ImageOff size={13} color="var(--text-muted)" />}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span className="chip" style={{ background: color + '14', color }}>
                          <PlacementIcon name={PLACEMENT_ICONS[b.placement] || ''} size={12} color={color} /> {b.placement}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{b.brand_id ? brandName(b.brand_id) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ padding: '8px 12px' }} className="mono">{fmtSize(b.file_size) || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`dot ${b.is_active ? 'dot-active' : 'dot-off'}`} /> {b.is_active ? 'Bật' : 'Tắt'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(b.id)} style={{ padding: '4px', color: 'var(--danger)' }} title="Xóa banner"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {groups.map(({ placement, items }) => {
              const color = PLACEMENT_COLORS[placement] || '#71717A'
              return (
                <section key={placement}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '7px', background: color + '18', color }}>
                      <PlacementIcon name={PLACEMENT_ICONS[placement] || ''} size={15} color={color} />
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', textTransform: 'capitalize' }}>{placement}</span>
                    <span className="chip" style={{ background: color + '14', color }}>{items.length}</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>

                  {/* Cards — nhỏ gọn, ảnh contain hiện đầy đủ */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {items.map(b => (
                      <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
                        {/* Image frame — contain trên nền ca-rô để hiện đầy đủ */}
                        <div
                          className="img-frame"
                          onClick={() => b.image_url && setPreview(b)}
                          style={{ height: '110px', cursor: b.image_url ? 'zoom-in' : 'default', borderBottom: '1px solid var(--border)' }}
                        >
                          {b.image_url ? (
                            <>
                              <img src={b.image_url} alt={b.title} />
                              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(24,24,27,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
                                <Maximize2 size={12} />
                              </span>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                              <ImageOff size={18} />
                              <span style={{ fontSize: '10.5px' }}>Không có ảnh</span>
                            </div>
                          )}
                          {!b.is_active && (
                            <span style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '9.5px', fontWeight: 600, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px' }}>Off</span>
                          )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {b.brand_id ? (
                              <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandName(b.brand_id)}</div>
                            ) : (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa gắn brand</div>
                            )}
                            <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{fmtSize(b.file_size) || b.id.slice(0, 8)}</div>
                          </div>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(b.id)} style={{ padding: '4px', color: 'var(--danger)' }} title="Xóa banner">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox xem đầy đủ */}
      {preview && preview.image_url && (
        <div className="modal-overlay" onClick={() => setPreview(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)} style={{ position: 'fixed', top: '20px', right: '20px', color: '#fff', zIndex: 1 }}><X size={20} /></button>
          <div className="img-frame" onClick={e => e.stopPropagation()} style={{ flexDirection: 'column', borderRadius: 'var(--radius-lg)', padding: '12px', maxWidth: '90vw', maxHeight: '85vh' }}>
            <img src={preview.image_url} alt={preview.title} style={{ maxHeight: 'calc(85vh - 64px)' }} />
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span className="chip" style={{ background: (PLACEMENT_COLORS[preview.placement] || '#71717A') + '14', color: PLACEMENT_COLORS[preview.placement] || '#71717A' }}>{preview.placement}</span>
              {preview.brand_id && <span style={{ fontWeight: 600 }}>{brandName(preview.brand_id)}</span>}
              {preview.file_size ? <span className="mono" style={{ color: 'var(--text-muted)' }}>{fmtSize(preview.file_size)}</span> : null}
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" style={{ width: '480px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">Upload banner (nhiều ảnh)<button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}><X size={16} /></button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Vị trí (placement)</label>
                <Select value={upForm.placement} onChange={v => setUpForm(f => ({ ...f, placement: v }))} options={uploadPlacementOpts} />
              </div>
              <div>
                <label className="label">Brand (tùy chọn)</label>
                <Select value={upForm.brand_id} onChange={v => setUpForm(f => ({ ...f, brand_id: v }))} options={uploadBrandOpts} placeholder="— Không gắn brand —" />
              </div>
              <div>
                <label className="label">Click URL (để trống = dùng URL brand)</label>
                <input className="input" value={upForm.click_url} onChange={e => setUpForm(f => ({ ...f, click_url: e.target.value }))} placeholder="(tùy chọn)" />
              </div>
              <div>
                <label className="label">Ảnh (kéo-thả hoặc chọn nhiều)</label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input')?.click()}
                  style={{
                    border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border-strong)'}`,
                    borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer',
                    background: dragActive ? 'var(--bg-active)' : 'var(--bg-subtle)', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--accent)' }}><Upload size={24} /></div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Kéo-thả ảnh vào đây, hoặc bấm để chọn
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>jpg, png, gif, webp · tối đa 5MB/ảnh</div>
                  <input id="file-input" type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
                </div>

                {files.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{files.length} ảnh đã chọn:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {files.map((f, i) => (
                        <div key={i} className="img-frame" style={{ position: 'relative', aspectRatio: '1', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <img src={URL.createObjectURL(f)} alt={f.name} />
                          <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)) }}
                            style={{ position: 'absolute', top: '-5px', right: '-5px', width: '18px', height: '18px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '11px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>{uploading ? 'Đang upload...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
