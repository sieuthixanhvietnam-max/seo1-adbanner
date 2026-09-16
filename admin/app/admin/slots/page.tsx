'use client'
import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import SiteSwitcher from '@/components/SiteSwitcher'
import { slotApi, bannerApi, siteApi, brandApi } from '@/lib/api'
import { imgUrl } from '@/lib/api'
import type { Slot, Banner, PlacementConfig } from '@/lib/types'
import { PLACEMENT_COLORS, PLACEMENT_ICONS } from '@/lib/types'
import { PlacementIcon } from '@/lib/icons'
import { Select } from '@/components/ui/Select'
import { Globe, ImageOff, X, GripVertical, ZoomIn } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px', overflow: 'hidden',
          maxWidth: '720px', width: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}>
        <div style={{
          background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '200px', maxHeight: '70vh', overflow: 'hidden',
        }}>
          {banner.image_url
            ? <img src={imgUrl(banner.image_url)} alt={banner.title}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
            : <ImageOff size={40} color="#666" />}
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
              {banner.title || '(không có tiêu đề)'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {banner.brand_id && <span className="chip" style={{ marginRight: '6px' }}>{banner.brand_id}</span>}
              {banner.placement && <span className="chip">{banner.placement}</span>}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={14} /> Đóng</button>
        </div>
      </div>
    </div>
  )
}

// ─── Pool Banner — chỉ drag handle mới initiate drag, click ảnh = preview ─────
function PoolBanner({ banner, onPreview }: { banner: Banner; onPreview: (b: Banner) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${banner.id}`, data: { banner, from: 'pool' },
  })
  const [hover, setHover] = useState(false)

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ opacity: isDragging ? 0.35 : 1, background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', transition: 'box-shadow 0.12s', boxShadow: hover ? '0 2px 10px rgba(0,0,0,0.10)' : 'none', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Image — click = preview (PointerSensor distance:5 phân biệt click vs drag) */}
      <div onClick={() => !isDragging && onPreview(banner)}
        style={{ position: 'relative', cursor: 'inherit', background: '#F1F5F9', lineHeight: 0 }}>
        <div className="img-frame" style={{ width: '100%', aspectRatio: '16/9' }}>
          {banner.image_url
            ? <img src={imgUrl(banner.image_url)} alt={banner.title} />
            : <ImageOff size={18} color="var(--text-muted)" />}
        </div>
        {hover && !isDragging && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <ZoomIn size={22} color="#fff" />
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', gap: '6px' }}>
        <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {banner.brand_id || 'no brand'}
        </span>
        <GripVertical size={14} color="var(--border-strong)" />
      </div>
    </div>
  )
}

// ─── Sortable banner trong slot ────────────────────────────────────────────────
function SlotBannerChip({ id, banner, order, mode, onRemove, onPreview }: {
  id: string; banner: any; order: number; mode: string
  onRemove: () => void; onPreview: (b: Banner) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={{ ...style, position: 'relative', touchAction: 'none' }}>
      <div style={{ position: 'relative', width: '72px' }}>
        <div {...attributes} {...listeners}
          className="img-frame"
          style={{ width: '72px', height: '46px', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'grab', overflow: 'hidden' }}>
          {banner.image_url ? <img src={imgUrl(banner.image_url)} alt="" /> : <ImageOff size={13} color="var(--text-muted)" />}
        </div>
        {/* Preview button */}
        <button onClick={() => onPreview(banner)}
          style={{ position: 'absolute', bottom: '2px', left: '2px', width: '16px', height: '16px', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          title="Xem ảnh">
          <ZoomIn size={9} color="#fff" />
        </button>
        {/* Remove */}
        <button onClick={onRemove}
          style={{ position: 'absolute', top: '-5px', right: '-5px', width: '16px', height: '16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
        {mode === 'rotate' && (
          <div style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '0 3px', borderRadius: '2px' }}>{order + 1}</div>
        )}
      </div>
    </div>
  )
}

// ─── Brand selector cho button/brand-button slot ───────────────────────────────
function ButtonBrandSelector({ slot, brands, onUpdate }: {
  slot: Slot
  brands: import('@/lib/types').Brand[]
  onUpdate: (slotId: string, data: any) => void
}) {
  const [open, setOpen] = useState(false)
  const activeBrands = brands.filter(b => b.is_active)

  if (open) return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Chọn nhà cái</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
        {activeBrands.map(b => (
          <button key={b.id}
            onClick={() => { onUpdate(slot.id, { brand_id: b.id }); setOpen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
            {b.logo_url
              ? <img src={imgUrl(b.logo_url)} alt="" style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} />
              : <span style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '4px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700 }}>{b.name[0]}</span>}
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}>Huỷ</button>
    </div>
  )

  if (slot.brand_id) return (
    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {slot.brand_logo_url
        ? <img src={imgUrl(slot.brand_logo_url)} alt="" style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', flexShrink: 0 }} />
        : <span style={{ width: '34px', height: '34px', background: 'var(--accent)', borderRadius: '6px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700 }}>{slot.brand_name?.[0]}</span>}
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.brand_name}</span>
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">Đổi</button>
      <button onClick={() => onUpdate(slot.id, { brand_id: null })} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
        <X size={13} />
      </button>
    </div>
  )

  return (
    <button onClick={() => setOpen(true)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', gap: '6px' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
      <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Gán nhà cái
    </button>
  )
}

// ─── Slot Card ─────────────────────────────────────────────────────────────────
function SlotCard({ slot, color, brands, onUpdate, onDropBanner, onReorder, onRemoveBanner, onPreview }: {
  slot: Slot; color: string
  brands: import('@/lib/types').Brand[]
  onUpdate: (slotId: string, data: any) => void
  onDropBanner: (slotId: string, banner: Banner) => void
  onReorder: (slotId: string, order: string[]) => void
  onRemoveBanner: (slotId: string, bannerId: string) => void
  onPreview: (b: Banner) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot.id}`, data: { slotId: slot.id } })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const isButton = slot.placement === 'button'
  const hasBanners = slot.banners.length > 0

  const handleInnerReorder = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = slot.banners.map(b => `sb:${slot.id}:${b.id}`)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    onReorder(slot.id, arrayMove(slot.banners, oldIdx, newIdx).map(b => b.id))
  }

  return (
    <div ref={setNodeRef} style={{
      border: `1.5px solid ${isOver ? color : slot.is_active ? color + '35' : 'var(--border)'}`,
      borderRadius: '12px', overflow: 'hidden',
      opacity: slot.is_active ? 1 : 0.55,
      background: isOver ? color + '08' : '#fff',
      outline: isOver ? `3px solid ${color}30` : 'none',
      transition: 'all 0.12s',
    }}>
      {/* Card header */}
      <div style={{ padding: '7px 10px 7px 12px', background: color + '12', borderBottom: `1px solid ${color}20`, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontWeight: 800, fontSize: '13px', color, minWidth: '22px' }}>#{slot.position}</span>
        {!isButton && (
          <Select
            value={slot.display_mode} onChange={v => onUpdate(slot.id, { display_mode: v })}
            disabled={!slot.is_active} size="sm" minWidth={88}
            options={[{ value: 'fixed', label: 'Fixed' }, { value: 'rotate', label: 'Rotate' }]}
          />
        )}
        {/* Banner count badge */}
        {!isButton && hasBanners && (
          <span style={{ fontSize: '10px', background: color + '22', color, padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
            {slot.banners.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Toggle */}
        <button onClick={() => onUpdate(slot.id, { is_active: !slot.is_active })}
          title={slot.is_active ? 'Đang bật' : 'Đang tắt'}
          style={{ width: '28px', height: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: slot.is_active ? color : '#CBD5E1', position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', width: '12px', height: '12px', background: '#fff', borderRadius: '50%', top: '2px', left: slot.is_active ? '14px' : '2px', transition: 'left 0.18s' }} />
        </button>
      </div>

      {/* Card body */}
      {isButton ? (
        <ButtonBrandSelector slot={slot} brands={brands} onUpdate={onUpdate} />
      ) : (
        <div style={{ padding: '10px', minHeight: '70px' }}>
          {slot.banners.length === 0 ? (
            <div style={{
              border: `1.5px dashed ${color}40`, borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '14px 8px', fontSize: '11px', color: `${color}90`, fontStyle: 'italic',
            }}>
              Kéo banner vào đây
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInnerReorder}>
              <SortableContext items={slot.banners.map(b => `sb:${slot.id}:${b.id}`)} strategy={horizontalListSortingStrategy}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {slot.banners.map((b, i) => (
                    <SlotBannerChip key={b.id} id={`sb:${slot.id}:${b.id}`} banner={b} order={i}
                      mode={slot.display_mode}
                      onRemove={() => onRemoveBanner(slot.id, b.id)}
                      onPreview={onPreview} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SlotsPage() {
  const [siteId, setSiteId] = useState<string>('')
  useEffect(() => {
    const stored = localStorage.getItem('active_site')
    if (stored) setSiteId(stored)
  }, [])
  const [slots, setSlots] = useState<Record<string, Slot[]>>({})
  const [placements, setPlacements] = useState<Record<string, PlacementConfig>>({})
  const [pool, setPool] = useState<Banner[]>([])
  const [poolFilter, setPoolFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeBanner, setActiveBanner] = useState<Banner | null>(null)
  const [brands, setBrands] = useState<import('@/lib/types').Brand[]>([])
  const [preview, setPreview] = useState<Banner | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleSiteChange = (id: string) => { setSiteId(id); localStorage.setItem('active_site', id) }

  const load = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const [slotsRes, siteRes] = await Promise.all([slotApi.getBySite(siteId), siteApi.getOne(siteId)])
    if (slotsRes.success) setSlots(slotsRes.data || {})
    if (siteRes.success) setPlacements(siteRes.data?.placements || {})
    setLoading(false)
  }, [siteId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const params: any = {}
    if (poolFilter) params.placement = poolFilter
    bannerApi.getAll(params).then(r => { if (r.success) setPool(r.data || []) })
  }, [poolFilter])

  useEffect(() => {
    brandApi.getAll().then(r => { if (r.success) setBrands(r.data || []) })
  }, [])

  const findSlot = (slotId: string): Slot | undefined =>
    Object.values(slots).flat().find(s => s.id === slotId)

  const handleUpdate = async (slotId: string, data: any) => {
    await slotApi.update(slotId, data)
    load()
  }

  const handleDropBanner = async (slotId: string, banner: Banner) => {
    const slot = findSlot(slotId)
    if (!slot) return
    if (slot.banners.some(b => b.id === banner.id)) return
    const existing = slot.banners.map((b, i) => ({ banner_id: b.id, order_in_rotation: i }))
    await slotApi.setBanners(slotId, [...existing, { banner_id: banner.id, order_in_rotation: existing.length }])
    load()
  }

  const handleReorder = async (slotId: string, order: string[]) => {
    await slotApi.setBanners(slotId, order.map((bid, i) => ({ banner_id: bid, order_in_rotation: i })))
    load()
  }

  const handleRemoveBanner = async (slotId: string, bannerId: string) => {
    await slotApi.removeBanner(slotId, bannerId)
    load()
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveBanner(null)
    const { active, over } = e
    if (!over) return
    const activeData = active.data.current
    const overData = over.data.current
    if (activeData?.from === 'pool' && overData?.slotId) {
      handleDropBanner(overData.slotId, activeData.banner)
    }
  }

  // Count tổng banner đã gán
  const totalAssigned = Object.values(slots).flat().reduce((acc, s) => acc + (s.banners?.length || 0), 0)

  return (
    <div>
      <Header title="Slot Manager" actions={<SiteSwitcher value={siteId} onChange={handleSiteChange} />} />

      {preview && <PreviewModal banner={preview} onClose={() => setPreview(null)} />}

      {!siteId ? (
        <div className="empty">
          <div className="empty-icon"><Globe size={20} /></div>
          <div style={{ fontSize: '14px', fontWeight: 550, color: 'var(--text-secondary)' }}>Chọn site để quản lý slots</div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={e => setActiveBanner(e.active.data.current?.banner || null)}
          onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', height: 'calc(100vh - var(--topbar-h))' }}>

            {/* ── LEFT: Slot groups ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
              ) : Object.keys(placements).length === 0 ? (
                <div className="empty">
                  <div className="empty-icon"><Globe size={20} /></div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Site chưa cấu hình placements</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {Object.entries(placements).map(([placement, cfg]) => {
                    const placementSlots = slots[placement] || []
                    const color = PLACEMENT_COLORS[placement] || '#64748b'
                    const activeCount = placementSlots.filter(s => s.is_active).length
                    const isButton = placement === 'button'

                    return (
                      <div key={placement}>
                        {/* Placement header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <PlacementIcon name={PLACEMENT_ICONS[placement]} size={15} color={color} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color }}>{cfg.label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '10px' }}>
                            {activeCount}/{placementSlots.length} bật
                          </span>
                          <div style={{ flex: 1, height: '1px', background: color + '20' }} />
                        </div>

                        {/* Slot grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: isButton
                            ? 'repeat(auto-fill, minmax(260px, 1fr))'
                            : 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '10px',
                        }}>
                          {placementSlots.map(slot => (
                            <SlotCard key={slot.id} slot={slot} color={color} brands={brands}
                              onUpdate={handleUpdate} onDropBanner={handleDropBanner}
                              onReorder={handleReorder} onRemoveBanner={handleRemoveBanner}
                              onPreview={setPreview} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT: Banner Pool ── */}
            <div style={{ width: '296px', borderLeft: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Pool header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>Banner Pool</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pool.length} ảnh</span>
                </div>
                <Select value={poolFilter} onChange={setPoolFilter} size="sm"
                  options={[
                    { value: '', label: 'Tất cả vị trí' },
                    ...['catfish', 'popup', 'slider', 'brand-button'].map(p => ({
                      value: p, label: p,
                      icon: <PlacementIcon name={PLACEMENT_ICONS[p] || ''} size={13} color={PLACEMENT_COLORS[p] || '#71717A'} />,
                    })),
                  ]} />
              </div>

              {/* Pool grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignContent: 'start' }}>
                {pool.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Chưa có banner.
                    <br />Vào Banner Pool để upload.
                  </div>
                ) : pool.map(b => <PoolBanner key={b.id} banner={b} onPreview={setPreview} />)}
              </div>

              {/* Pool footer */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GripVertical size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Kéo ảnh thả vào slot · Click ảnh để xem
                </span>
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeBanner && (
              <div className="img-frame" style={{ width: '130px', aspectRatio: '16/9', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.30)', overflow: 'hidden' }}>
                {activeBanner.image_url ? <img src={imgUrl(activeBanner.image_url)} alt="" /> : <ImageOff size={18} color="var(--text-muted)" />}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
