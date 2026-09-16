'use client'
import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import SiteSwitcher from '@/components/SiteSwitcher'
import { toplistApi, brandApi } from '@/lib/api'
import { imgUrl } from '@/lib/api'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trophy, GripVertical, Info, ImageOff, Plus } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ToastProvider'

interface TLEntry {
  id: string; brand_id: string; rank: number; name: string
  login_url: string; image_url: string; is_active: boolean
}
interface Brand { id: string; name: string }

// ─── Sortable row ─────────────────────────────────────────────────────────────
function SortableRow({ entry, onDelete, onChangeImage }: {
  entry: TLEntry; onDelete: (id: string) => void; onChangeImage: (id: string, file: File) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <div ref={setNodeRef} style={{
      ...style,
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '12px 16px', background: '#fff',
      border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '8px',
      boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
    }}>
      {/* Drag handle */}
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', touchAction: 'none' }}><GripVertical size={16} /></div>

      {/* Rank badge */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
        background: entry.rank <= 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][entry.rank - 1] : '#EFF6FF',
        color: entry.rank <= 3 ? '#000' : '#2563EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px',
      }}>#{entry.rank}</div>

      {/* Image */}
      {entry.image_url ? (
        <div className="img-frame" style={{ width: '80px', height: '45px', borderRadius: '6px', border: '1px solid var(--border)', flexShrink: 0 }}>
          <img src={imgUrl(entry.image_url)} alt={entry.name} />
        </div>
      ) : (
        <div style={{ width: '80px', height: '45px', borderRadius: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
          <ImageOff size={16} />
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>{entry.name}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{entry.login_url || '(chưa có link)'}</div>
      </div>

      {/* Actions */}
      <label style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: 'transparent' }}>
        Đổi ảnh
        <input type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && onChangeImage(entry.id, e.target.files[0])} />
      </label>
      <button onClick={() => onDelete(entry.id)} style={{ padding: '5px 12px', border: '1px solid #FCA5A5', borderRadius: '6px', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}>Xóa</button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ToplistPage() {
  // Bắt đầu rỗng để server & client render khớp nhau; đọc localStorage sau khi mount
  const { toast } = useToast()
  const [siteId, setSiteId] = useState<string>('')
  useEffect(() => {
    const stored = localStorage.getItem('active_site')
    if (stored) setSiteId(stored)
  }, [])
  const [entries, setEntries] = useState<TLEntry[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addBrand, setAddBrand] = useState('')
  const [addFile, setAddFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleSiteChange = (id: string) => { setSiteId(id); localStorage.setItem('active_site', id) }

  const load = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const [tRes, bRes] = await Promise.all([toplistApi.getBySite(siteId), brandApi.getAll()])
    if (tRes.success) setEntries(tRes.data || [])
    if (bRes.success) setBrands(bRes.data || [])
    setLoading(false)
  }, [siteId])
  useEffect(() => { load() }, [load])

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = entries.findIndex(x => x.id === active.id)
    const newIdx = entries.findIndex(x => x.id === over.id)
    const reordered = arrayMove(entries, oldIdx, newIdx).map((x, i) => ({ ...x, rank: i + 1 }))
    setEntries(reordered)
    await toplistApi.reorder(siteId, reordered.map(x => x.id))
  }

  const handleAdd = async () => {
    if (!addBrand) return
    setSaving(true)
    const fd = new FormData()
    fd.append('site_id', siteId)
    fd.append('brand_id', addBrand)
    if (addFile) fd.append('image', addFile)
    const res = await toplistApi.create(fd)
    setSaving(false)
    if (res.success) { setShowAdd(false); setAddBrand(''); setAddFile(null); load() }
    else toast(res.message, 'error')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa mục này khỏi toplist?')) return
    await toplistApi.delete(id); load()
  }

  const handleChangeImage = async (id: string, file: File) => {
    const fd = new FormData(); fd.append('image', file)
    await toplistApi.update(id, fd); load()
  }

  const availableBrands = brands.filter(b => !entries.some(e => e.brand_id === b.id))

  return (
    <div>
      <Header title="Toplist" actions={
        <>
          <SiteSwitcher value={siteId} onChange={handleSiteChange} />
          {siteId && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Thêm nhà cái</button>
          )}
        </>
      } />

      <div style={{ padding: '24px 28px' }}>
        {!siteId ? (
          <div className="empty">
            <div className="empty-icon"><Trophy size={20} /></div>
            <div style={{ fontSize: '14px', fontWeight: 550, color: 'var(--text-secondary)' }}>Chọn site để quản lý toplist</div>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : entries.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Trophy size={20} /></div>
            <div>Chưa có nhà cái. Thêm để tạo bảng xếp hạng.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              <Info size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />Kéo để đổi thứ hạng. Mô tả đánh giá do WordPress tự nhập.
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
                {entries.map(entry => (
                  <SortableRow key={entry.id} entry={entry} onDelete={handleDelete} onChangeImage={handleChangeImage} />
                ))}
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '440px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '15px' }}>Thêm nhà cái vào toplist</div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Chọn brand</label>
                <Select value={addBrand} onChange={setAddBrand} placeholder="— Chọn nhà cái —"
                  options={availableBrands.map(b => ({ value: b.id, label: b.name }))} />
                {availableBrands.length === 0 && <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '4px' }}>Tất cả brand đã có trong toplist</div>}
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Ảnh riêng cho toplist (banner ngang, tùy chọn)</label>
                <input type="file" accept="image/*" onChange={e => setAddFile(e.target.files?.[0] || null)} style={{ fontSize: '12px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Bỏ trống = dùng logo brand</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '7px', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}>Hủy</button>
                <button onClick={handleAdd} disabled={saving || !addBrand} style={{ padding: '8px 20px', background: addBrand ? '#2563EB' : '#93C5FD', color: '#fff', border: 'none', borderRadius: '7px', cursor: addBrand ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 600 }}>
                  {saving ? 'Đang thêm...' : 'Thêm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
