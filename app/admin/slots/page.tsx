'use client'
import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import SiteSwitcher from '@/components/SiteSwitcher'
import { slotApi, bannerApi, siteApi, brandApi } from '@/lib/api'
import type { Slot, Banner, PlacementConfig } from '@/lib/types'
import { PLACEMENT_COLORS, PLACEMENT_ICONS } from '@/lib/types'
import { PlacementIcon } from '@/lib/icons'
import { Select, type SelectOption } from '@/components/ui/Select'
import { ColorControl, SliderControl, SegmentControl } from '@/components/ui/StyleControls'
import {
  Globe, Info, ImageOff, Palette, Check, X,
  LogIn, UserPlus, ArrowRight, Star, Gift, Zap, Trophy, DollarSign, Flame, Crown,
} from 'lucide-react'

// ─── Button per-slot style editor ─────────────────────────────────────────────
const BTN_ICONS: Record<string, any> = { LogIn, UserPlus, ArrowRight, Star, Gift, Zap, Trophy, DollarSign, Flame, Crown }
const DEFAULT_BUTTON_STYLE = {
  bgColor: '#6366F1', textColor: '#ffffff', label: 'Đăng nhập',
  icon: 'LogIn', iconPosition: 'left', borderRadius: 8, hoverEffect: 'darken',
}

function ButtonStyleEditor({ slotId, style, onSave }: {
  slotId: string; style: Record<string, any>; onSave: (slotId: string, style: Record<string, any>) => void
}) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<Record<string, any>>({ ...DEFAULT_BUTTON_STYLE, ...style })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setSt(s => ({ ...s, [k]: v }))

  const save = async () => {
    setSaving(true)
    await onSave(slotId, st)
    setSaving(false); setOpen(false)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '7px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        <Palette size={13} /> Chỉnh style
        {style && Object.keys(style).length > 0 && <span className="dot" style={{ background: 'var(--accent)', marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <ColorControl label="Màu nền" value={st.bgColor} onChange={v => set('bgColor', v)} />
          <ColorControl label="Màu chữ" value={st.textColor} onChange={v => set('textColor', v)} />
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Nhãn nút</label>
            <input className="input" value={st.label ?? ''} onChange={e => set('label', e.target.value)} />
          </div>
          {/* Icon picker gọn */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              <button type="button" onClick={() => set('icon', '')} title="Không icon"
                style={{ width: '30px', height: '30px', border: `1px solid ${!st.icon ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-sm)', background: !st.icon ? 'var(--accent-subtle)' : 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
              {Object.entries(BTN_ICONS).map(([name, Icon]) => {
                const active = st.icon === name
                return (
                  <button key={name} type="button" onClick={() => set('icon', name)} title={name}
                    style={{ width: '30px', height: '30px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-sm)', background: active ? 'var(--accent-subtle)' : 'var(--bg)', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} />
                  </button>
                )
              })}
            </div>
          </div>
          {st.icon && <SegmentControl label="Vị trí icon" value={st.iconPosition} options={[{ value: 'left', label: 'Trái' }, { value: 'right', label: 'Phải' }]} onChange={v => set('iconPosition', v)} />}
          <SliderControl label="Bo góc" value={st.borderRadius} min={0} max={32} unit="px" onChange={v => set('borderRadius', v)} />
          <SegmentControl label="Hiệu ứng hover" value={st.hoverEffect} options={[{ value: 'none', label: 'None' }, { value: 'darken', label: 'Darken' }, { value: 'brighten', label: 'Brighten' }, { value: 'scale', label: 'Scale' }]} onChange={v => set('hoverEffect', v)} />
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
            {saving ? 'Đang lưu...' : <><Check size={13} /> Lưu style</>}
          </button>
        </div>
      )}
    </div>
  )
}
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Draggable banner từ pool ─────────────────────────────────────────────────
function PoolBanner({ banner }: { banner: Banner }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${banner.id}`, data: { banner, from: 'pool' },
  })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{
        cursor: 'grab', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden',
        opacity: isDragging ? 0.4 : 1, touchAction: 'none', background: '#fff',
      }}>
      <div className="img-frame" style={{ width: '100%', aspectRatio: '16/9' }}>
        {banner.image_url ? <img src={banner.image_url} alt={banner.title} /> : <ImageOff size={16} color="var(--text-muted)" />}
      </div>
      <div style={{ padding: '4px 6px', fontSize: '10px', color: 'var(--text-muted)' }}>{banner.brand_id || 'no brand'}</div>
    </div>
  )
}

// ─── Sortable banner trong slot (rotate) ──────────────────────────────────────
function SlotBannerChip({ id, banner, order, mode, onRemove }: {
  id: string; banner: any; order: number; mode: string; onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={{ ...style, position: 'relative', width: '58px', touchAction: 'none' }}>
      <div className="img-frame" {...attributes} {...listeners}
        style={{ width: '58px', height: '38px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'grab' }}>
        {banner.image_url ? <img src={banner.image_url} alt="" /> : <ImageOff size={13} color="var(--text-muted)" />}
      </div>
      <button onClick={onRemove}
        style={{ position: 'absolute', top: '-5px', right: '-5px', width: '15px', height: '15px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '9px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      {mode === 'rotate' && <div style={{ position: 'absolute', bottom: '1px', left: '1px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '0 3px', borderRadius: '2px' }}>{order + 1}</div>}
    </div>
  )
}

// ─── Brand selector dành riêng cho button slot ───────────────────────────────
function ButtonBrandSelector({ slot, brands, onUpdate }: {
  slot: Slot
  brands: import('@/lib/types').Brand[]
  onUpdate: (slotId: string, data: any) => void
}) {
  const [open, setOpen] = useState(false)
  const activeBrands = brands.filter(b => b.is_active)

  if (open) {
    return (
      <div style={{ padding: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', paddingLeft: '2px' }}>
          Chọn nhà cái
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '140px', overflowY: 'auto' }}>
          {activeBrands.map(b => (
            <button key={b.id}
              onClick={() => { onUpdate(slot.id, { brand_id: b.id }); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 8px', border: 'none', borderRadius: '6px',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {b.logo_url
                ? <img src={b.logo_url} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '3px', border: '1px solid var(--border)', flexShrink: 0 }} />
                : <span style={{ width: '18px', height: '18px', background: 'var(--accent)', borderRadius: '3px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '8px', fontWeight: 700 }}>{b.name[0]}</span>
                  </span>}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{b.name}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(false)}
          style={{ marginTop: '6px', width: '100%', padding: '4px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}>
          Huỷ
        </button>
      </div>
    )
  }

  if (slot.brand_id) {
    return (
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {slot.brand_logo_url
          ? <img src={slot.brand_logo_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border)', flexShrink: 0 }} />
          : <span style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '4px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700 }}>{slot.brand_name?.[0]}</span>
            </span>}
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.brand_name}</span>
        <button onClick={() => setOpen(true)} title="Đổi nhà cái"
          style={{ padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
          Đổi
        </button>
        <button onClick={() => onUpdate(slot.id, { brand_id: null })} title="Xoá"
          style={{ padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '10px', border: 'none',
        background: 'transparent', cursor: 'pointer',
        fontSize: '11.5px', color: 'var(--text-muted)',
        gap: '4px',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Gán nhà cái
    </button>
  )
}

// ─── Droppable slot ───────────────────────────────────────────────────────────
function SlotCard({ slot, color, brands, onUpdate, onDropBanner, onReorder, onRemoveBanner, onSaveSlotStyle }: {
  slot: Slot; color: string
  brands: import('@/lib/types').Brand[]
  onUpdate: (slotId: string, data: any) => void
  onDropBanner: (slotId: string, banner: Banner) => void
  onReorder: (slotId: string, order: string[]) => void
  onRemoveBanner: (slotId: string, bannerId: string) => void
  onSaveSlotStyle: (slotId: string, style: Record<string, any>) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot.id}`, data: { slotId: slot.id } })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleInnerReorder = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = slot.banners.map(b => `sb:${slot.id}:${b.id}`)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(slot.banners, oldIdx, newIdx)
    onReorder(slot.id, reordered.map(b => b.id))
  }

  return (
    <div ref={setNodeRef} style={{
      border: `1px solid ${slot.is_active ? color + '40' : '#E2E8F0'}`,
      borderRadius: '10px', overflow: 'hidden',
      opacity: slot.is_active ? 1 : 0.6,
      background: isOver ? color + '10' : slot.is_active ? '#fff' : '#F8FAFC',
      outline: isOver ? `2px dashed ${color}` : 'none',
      transition: 'all 0.12s',
    }}>
      <div style={{ padding: '8px 10px', background: color + '10', borderBottom: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: '12px', color }}>#{slot.position}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Select
            value={slot.display_mode} onChange={v => onUpdate(slot.id, { display_mode: v })}
            disabled={!slot.is_active} size="sm" minWidth={92}
            options={[{ value: 'fixed', label: 'Fixed' }, { value: 'rotate', label: 'Rotate' }]}
          />
          <button onClick={() => onUpdate(slot.id, { is_active: !slot.is_active })}
            style={{ width: '26px', height: '15px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: slot.is_active ? color : '#CBD5E1', position: 'relative' }}>
            <span style={{ position: 'absolute', width: '11px', height: '11px', background: '#fff', borderRadius: '50%', top: '2px', left: slot.is_active ? '13px' : '2px', transition: 'left 0.2s' }} />
          </button>
        </div>
      </div>
      {slot.placement === 'button' ? (
        /* Button slot: chọn brand trực tiếp, không dùng banner */
        <ButtonBrandSelector slot={slot} brands={brands} onUpdate={onUpdate} />
      ) : (
        /* Các placement khác: drag-drop banner */
        <div style={{ padding: '10px', minHeight: '56px' }}>
          {slot.banners.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
              Kéo banner vào đây
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInnerReorder}>
              <SortableContext items={slot.banners.map(b => `sb:${slot.id}:${b.id}`)} strategy={horizontalListSortingStrategy}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {slot.banners.map((b, i) => (
                    <SlotBannerChip key={b.id} id={`sb:${slot.id}:${b.id}`} banner={b} order={i} mode={slot.display_mode}
                      onRemove={() => onRemoveBanner(slot.id, b.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
      {slot.placement === 'button' && (
        <ButtonStyleEditor slotId={slot.id} style={slot.slot_style || {}} onSave={onSaveSlotStyle} />
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SlotsPage() {
  // Bắt đầu rỗng để server & client render khớp nhau; đọc localStorage sau khi mount
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

  // Load pool theo placement filter
  useEffect(() => {
    const params: any = {}
    if (poolFilter) params.placement = poolFilter
    bannerApi.getAll(params).then(r => { if (r.success) setPool(r.data || []) })
  }, [poolFilter])

  // Load brands cho button slot picker
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
    if (slot.banners.some(b => b.id === banner.id)) return // đã có
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

  const handleSaveSlotStyle = async (slotId: string, style: Record<string, any>) => {
    await slotApi.update(slotId, { slot_style: style })
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

  const filteredPool = poolFilter ? pool : pool
  const _poolBrandIds = [...new Set(pool.map(b => b.brand_id).filter(Boolean))]

  return (
    <div>
      <Header title="Slot Manager" actions={<SiteSwitcher value={siteId} onChange={handleSiteChange} />} />

      {!siteId ? (
        <div className="empty">
          <div className="empty-icon"><Globe size={20} /></div>
          <div style={{ fontSize: '14px', fontWeight: 550, color: 'var(--text-secondary)' }}>Chọn site để quản lý slots</div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={e => setActiveBanner(e.active.data.current?.banner || null)}
          onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', height: 'calc(100vh - 61px)' }}>
            {/* LEFT: slots */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                  {Object.entries(placements).map(([placement, cfg]) => {
                    const placementSlots = slots[placement] || []
                    const color = PLACEMENT_COLORS[placement] || '#64748b'
                    return (
                      <div key={placement}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <PlacementIcon name={PLACEMENT_ICONS[placement]} size={16} color={color} />
                          <h2 style={{ fontSize: '14px', fontWeight: 700, color }}>{cfg.label}</h2>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({placementSlots.length}/{cfg.limit})</span>
                          <div style={{ flex: 1, height: '1px', background: color + '25' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                          {placementSlots.map(slot => (
                            <SlotCard key={slot.id} slot={slot} color={color} brands={brands}
                              onUpdate={handleUpdate} onDropBanner={handleDropBanner}
                              onReorder={handleReorder} onRemoveBanner={handleRemoveBanner}
                              onSaveSlotStyle={handleSaveSlotStyle} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: pool */}
            <div style={{ width: '280px', borderLeft: '1px solid var(--border)', background: '#FAFBFC', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Banner Pool</div>
                <Select value={poolFilter} onChange={setPoolFilter} size="sm"
                  options={[{ value: '', label: 'Tất cả vị trí' }, ...['catfish', 'button', 'popup', 'slider', 'brand-button'].map(p => ({
                    value: p, label: p,
                    icon: <PlacementIcon name={PLACEMENT_ICONS[p] || ''} size={13} color={PLACEMENT_COLORS[p] || '#71717A'} />,
                  }))]} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignContent: 'start' }}>
                {filteredPool.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Chưa có banner. Vào Banner Pool để upload.
                  </div>
                ) : filteredPool.map(b => <PoolBanner key={b.id} banner={b} />)}
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Kéo banner thả vào slot bên trái
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeBanner && (
              <div className="img-frame" style={{ width: '120px', aspectRatio: '16/9', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                {activeBanner.image_url ? <img src={activeBanner.image_url} alt="" /> : <ImageOff size={18} color="var(--text-muted)" />}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
