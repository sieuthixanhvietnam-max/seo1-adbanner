'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Badge, Box, Card, Collapse, Group, Loader, Modal, Paper, Progress, ScrollArea, SegmentedControl,
  Select, SimpleGrid, Stack, Text, ThemeIcon, Avatar, Tooltip,
} from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical, Globe, ImageOff, X, ZoomIn } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Page from '@/components/PageHeader'
import SiteSwitcher from '@/components/SiteSwitcher'
import ImageFrame from '@/components/ui/ImageFrame'
import StatusSwitch from '@/components/ui/StatusSwitch'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { PlacementIcon } from '@/lib/icons'
import { fmtSize, isHeavy, isNew, timeAgo, fullDate, formatOf, FormatBadge, AgeBadge } from '@/lib/bannerInfo'
import { slotApi, bannerApi, siteApi, brandApi, imgUrl } from '@/lib/api'
import type { Slot, Banner, Brand, PlacementConfig } from '@/lib/types'
import { PLACEMENT_COLORS, PLACEMENT_ICONS } from '@/lib/types'

const POOL_PLACEMENTS = ['catfish', 'popup', 'slider', 'brand-button']
const MODE_DATA = [{ value: 'fixed', label: 'Fixed' }, { value: 'rotate', label: 'Rotate' }]

// ─── Xem ảnh lớn ───────────────────────────────────────────────────────────────
function PreviewModal({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  return (
    <Modal opened={!!banner} onClose={onClose} size="lg" title={banner?.title || '(không có tiêu đề)'}>
      {banner && (
        <Stack>
          <ImageFrame natural src={banner.image_url ? imgUrl(banner.image_url) : null} alt={banner.title}
            style={{ minHeight: 200, maxHeight: '65vh', borderRadius: 'var(--mantine-radius-default)' }} />
          <Group gap="xs">
            {banner.brand_id && <Badge variant="light">{banner.brand_id}</Badge>}
            {banner.placement && <Badge variant="light" color={PLACEMENT_COLORS[banner.placement] || 'gray'}>{banner.placement}</Badge>}
            <FormatBadge b={banner} />
            <AgeBadge b={banner} />
            {isHeavy(banner) && <Badge variant="light" color="yellow" leftSection={<AlertTriangle size={11} />}>Nặng</Badge>}
          </Group>
          <Group gap="lg">
            <Text size="sm" c="dimmed">Dung lượng: <Text span ff="monospace" c="var(--mantine-color-text)">{fmtSize(banner.file_size) || '—'}</Text></Text>
            <Text size="sm" c="dimmed">Upload: <Text span c="var(--mantine-color-text)">{timeAgo(banner)}</Text>{fullDate(banner) && ` (${fullDate(banner)})`}</Text>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

// ─── Banner trong pool: kéo cả thẻ, click = xem ảnh ───────────────────────────
function PoolBanner({ banner, onPreview }: { banner: Banner; onPreview: (b: Banner) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pool:${banner.id}`, data: { banner, from: 'pool' } })
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Paper ref={setNodeRef} {...attributes} {...listeners} p={0}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', overflow: 'hidden' }}>
      <Box ref={ref} pos="relative" onClick={() => !isDragging && onPreview(banner)}>
        <ImageFrame src={banner.image_url ? imgUrl(banner.image_url) : null} alt={banner.title} style={{ aspectRatio: '16/9' }} />
        {isNew(banner) && <Badge size="xs" variant="filled" color="green" pos="absolute" top={6} right={6}>Mới</Badge>}
        <Group gap={4} pos="absolute" bottom={6} left={6} wrap="nowrap">
          <FormatBadge b={banner} size="xs" />
          {isHeavy(banner) && (
            <Tooltip label="Ảnh nặng hơn 500 KB"><Badge size="xs" variant="filled" color="yellow" px={4}><AlertTriangle size={10} /></Badge></Tooltip>
          )}
        </Group>
        {hovered && !isDragging && (
          <Box pos="absolute" inset={0} style={{ background: 'rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <ZoomIn size={18} color="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
          </Box>
        )}
      </Box>
      <Stack gap={2} px="xs" py={6}>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" fw={600} truncate style={{ flex: 1 }}>{banner.brand_id || 'không có brand'}</Text>
          <GripVertical size={14} color="var(--mantine-color-dimmed)" />
        </Group>
        <Group gap={4} wrap="nowrap" justify="space-between">
          <Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: 'nowrap' }}>{fmtSize(banner.file_size) || '—'}</Text>
          <Tooltip label={fullDate(banner) || 'Không rõ ngày upload'}>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{timeAgo(banner)}</Text>
          </Tooltip>
        </Group>
      </Stack>
    </Paper>
  )
}

// ─── Banner đã gán trong slot: ảnh đầy đủ + thông tin, sắp xếp bằng cách kéo ảnh ───
const SLOT_RATIO: Record<string, string> = { catfish: '3 / 1', popup: '16 / 9', slider: '16 / 9', 'brand-button': '2 / 1' }

function SlotBannerItem({ id, banner, brand, order, showOrder, ratio, onRemove, onPreview }: {
  id: string; banner: Banner; brand: string; order: number; showOrder: boolean; ratio: string
  onRemove: () => void; onPreview: (b: Banner) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <Paper ref={setNodeRef} p={0} style={{
      overflow: 'hidden', transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.4 : 1, touchAction: 'none',
    }}>
      <Box pos="relative">
        <ImageFrame {...attributes} {...listeners} src={banner.image_url ? imgUrl(banner.image_url) : null} alt={banner.title}
          style={{ aspectRatio: ratio, cursor: 'grab', borderBottom: '1px solid var(--mantine-color-default-border)' }} />
        {showOrder && (
          <Badge variant="filled" color="dark" pos="absolute" top={8} left={8} style={{ pointerEvents: 'none' }}>#{order + 1}</Badge>
        )}
        {isNew(banner) && <Badge variant="filled" color="green" pos="absolute" top={8} right={8} style={{ pointerEvents: 'none' }}>Mới</Badge>}
      </Box>

      <Stack gap={6} p="xs">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} truncate>{brand || banner.brand_id || 'Chưa gắn brand'}</Text>
            {banner.title && <Text size="xs" c="dimmed" truncate>{banner.title}</Text>}
          </Box>
          <Group gap={2} wrap="nowrap">
            <Tooltip label="Xem ảnh"><ActionIcon variant="subtle" color="gray" onClick={() => onPreview(banner)} aria-label="Xem ảnh"><ZoomIn size={16} /></ActionIcon></Tooltip>
            <Tooltip label="Gỡ khỏi slot"><ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="Gỡ banner"><X size={16} /></ActionIcon></Tooltip>
          </Group>
        </Group>
        <Group gap={6} wrap="wrap">
          <FormatBadge b={banner} />
          {isHeavy(banner) && (
            <Tooltip label="Ảnh nặng hơn 500 KB, nên nén lại"><Badge variant="light" color="yellow" tt="none" leftSection={<AlertTriangle size={11} />}>Nặng</Badge></Tooltip>
          )}
          <AgeBadge b={banner} />
          <Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: 'nowrap' }}>{fmtSize(banner.file_size) || '—'}</Text>
          <Tooltip label={fullDate(banner) || 'Không rõ ngày upload'}>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{timeAgo(banner)}</Text>
          </Tooltip>
        </Group>
      </Stack>
    </Paper>
  )
}

// ─── Chọn nhà cái cho slot dạng button ────────────────────────────────────────
function ButtonBrandPicker({ slot, brands, onUpdate }: { slot: Slot; brands: Brand[]; onUpdate: (slotId: string, data: any) => void }) {
  const byId = useMemo(() => new Map(brands.map(b => [b.id, b])), [brands])
  const options = useMemo(() => {
    const list = brands.filter(b => b.is_active || b.id === slot.brand_id)
    return list.map(b => ({ value: b.id, label: b.name }))
  }, [brands, slot.brand_id])
  const current = slot.brand_id ? byId.get(slot.brand_id) : undefined
  const logo = current?.logo_url || slot.brand_logo_url

  return (
    <Select
      aria-label="Nhà cái"
      placeholder="Gán nhà cái"
      searchable clearable
      nothingFoundMessage="Không tìm thấy nhà cái"
      data={options}
      value={slot.brand_id || null}
      onChange={v => onUpdate(slot.id, { brand_id: v })}
      leftSection={logo ? <Avatar src={imgUrl(logo)} size={20} radius="xs" /> : undefined}
      renderOption={({ option }) => {
        const b = byId.get(option.value)
        return (
          <Group gap="xs" wrap="nowrap">
            {b?.logo_url ? <Avatar src={imgUrl(b.logo_url)} size={22} radius="xs" /> : <Avatar size={22} radius="xs" color="brand">{option.label[0]}</Avatar>}
            <Text size="sm">{option.label}</Text>
          </Group>
        )
      }}
    />
  )
}

// ─── Thẻ slot ─────────────────────────────────────────────────────────────────
function SlotCard({ slot, color, brands, onUpdate, onReorder, onRemoveBanner, onPreview }: {
  slot: Slot; color: string; brands: Brand[]
  onUpdate: (slotId: string, data: any) => void
  onReorder: (slotId: string, order: string[]) => void
  onRemoveBanner: (slotId: string, bannerId: string) => void
  onPreview: (b: Banner) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot.id}`, data: { slotId: slot.id } })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const isButton = slot.placement === 'button'
  const ids = slot.banners.map(b => `sb:${slot.id}:${b.id}`)
  const brandName = (id?: string | null) => brands.find(x => x.id === id)?.name || ''

  const handleInnerReorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    if (from < 0 || to < 0) return
    onReorder(slot.id, arrayMove(slot.banners, from, to).map(b => b.id))
  }

  return (
    <Card ref={setNodeRef} p={0} style={{
      borderColor: isOver ? color : undefined,
      boxShadow: isOver ? `0 0 0 3px ${color}30` : undefined,
      opacity: slot.is_active ? 1 : 0.6,
      overflow: 'hidden', transition: 'box-shadow 0.12s, border-color 0.12s',
    }}>
      <Group px="sm" py={8} gap="xs" wrap="nowrap" style={{ background: `${color}12`, borderBottom: `1px solid ${color}25` }}>
        <Text fw={700} c={color} miw={28}>#{slot.position}</Text>
        {!isButton && (
          <SegmentedControl size="xs" data={MODE_DATA} value={slot.display_mode} disabled={!slot.is_active}
            onChange={v => onUpdate(slot.id, { display_mode: v })} />
        )}
        {!isButton && slot.banners.length > 0 && <Badge variant="light" color={color}>{slot.banners.length}</Badge>}
        <Box style={{ flex: 1 }} />
        <StatusSwitch color={color} checked={slot.is_active} aria-label={`Bật/tắt slot ${slot.position}`}
          onChange={() => onUpdate(slot.id, { is_active: !slot.is_active })} />
      </Group>

      <Box p="sm" mih={isButton ? undefined : 84}>
        {isButton ? (
          <Stack gap={6}>
            <ButtonBrandPicker slot={slot} brands={brands} onUpdate={onUpdate} />
            {slot.brand_id && (
              <Text size="xs" c="dimmed" ff="monospace" truncate>{brands.find(b => b.id === slot.brand_id)?.domain || 'Chưa có link đăng nhập'}</Text>
            )}
          </Stack>
        ) : slot.banners.length === 0 ? (
          <Box p="md" ta="center" style={{ border: `1.5px dashed ${color}55`, borderRadius: 'var(--mantine-radius-default)' }}>
            <Text size="xs" c="dimmed" fs="italic">Kéo banner vào đây</Text>
          </Box>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInnerReorder}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <Stack gap="sm">
                {slot.banners.map((b, i) => (
                  <SlotBannerItem key={b.id} id={`sb:${slot.id}:${b.id}`} banner={b} brand={brandName(b.brand_id)} order={i}
                    showOrder={slot.display_mode === 'rotate'} ratio={SLOT_RATIO[slot.placement] || '16 / 9'}
                    onRemove={() => onRemoveBanner(slot.id, b.id)} onPreview={onPreview} />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        )}
      </Box>
    </Card>
  )
}

// ─── Đầu nhóm placement: tên, cấu hình, tiến độ bật/gán, thu gọn ─────────────
function PlacementHeader({ placement, cfg, slots, color, collapsed, onToggle }: {
  placement: string; cfg: PlacementConfig; slots: Slot[]; color: string; collapsed: boolean; onToggle: () => void
}) {
  const isButton = placement === 'button'
  const total = slots.length
  const active = slots.filter(s => s.is_active).length
  const filled = slots.filter(s => (isButton ? !!s.brand_id : s.banners.length > 0)).length
  // Slot đang bật nhưng chưa có nội dung sẽ không hiển thị gì trên website
  const emptyActive = slots.filter(s => s.is_active && (isButton ? !s.brand_id : s.banners.length === 0)).length
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  const meter = (label: string, n: number, tone: string) => (
    <Box w={{ base: '100%', xs: 132 }}>
      <Group justify="space-between" gap={4} mb={4} wrap="nowrap">
        <Text size="xs" c="dimmed">{label}</Text>
        <Text size="xs" fw={600} ff="monospace">{n}/{total}</Text>
      </Group>
      <Progress value={pct(n)} color={tone} size="sm" />
    </Box>
  )

  return (
    <Paper p="sm">
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={40} radius="md" variant="default">
            <PlacementIcon name={PLACEMENT_ICONS[placement]} size={20} color={color} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Group gap={8} wrap="nowrap">
              <Text fw={700} size="md">{cfg.label}</Text>
              <Badge variant="light" color="gray" tt="none" ff="monospace">{placement}</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {total} slot · mặc định {cfg.default_mode === 'rotate' ? 'xoay vòng' : 'cố định'}
            </Text>
          </Box>
        </Group>

        <Group gap="lg" wrap="wrap" align="center">
          {emptyActive > 0 && (
            <Tooltip label="Slot đang bật nhưng chưa có nội dung sẽ không hiển thị gì trên website">
              <Badge variant="light" color="yellow" tt="none" leftSection={<AlertTriangle size={11} />}>{emptyActive} slot trống</Badge>
            </Tooltip>
          )}
          {meter('Đang bật', active, active === total ? color : 'gray')}
          {meter(isButton ? 'Đã gán nhà cái' : 'Đã gán ảnh', filled, filled === total ? 'green' : 'yellow')}
          <Tooltip label={collapsed ? 'Mở rộng' : 'Thu gọn'}>
            <ActionIcon variant="subtle" color="gray" onClick={onToggle} aria-label={collapsed ? 'Mở rộng nhóm' : 'Thu gọn nhóm'}>
              {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}

// ─── Trang ────────────────────────────────────────────────────────────────────
export default function SlotsPage() {
  const [siteId, setSiteId] = useState('')
  const [slots, setSlots] = useState<Record<string, Slot[]>>({})
  const [placements, setPlacements] = useState<Record<string, PlacementConfig>>({})
  const [pool, setPool] = useState<Banner[]>([])
  const [poolPlacement, setPoolPlacement] = useState<string | null>(null)
  const [poolQuery, setPoolQuery] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)
  const [activeBanner, setActiveBanner] = useState<Banner | null>(null)
  const [preview, setPreview] = useState<Banner | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    try { const s = localStorage.getItem('active_site'); if (s) setSiteId(s) } catch {}
  }, [])
  const changeSite = (id: string) => { setSiteId(id); try { localStorage.setItem('active_site', id) } catch {} }

  // silent = làm mới ngầm sau mỗi thao tác, không nháy màn hình loading
  const load = useCallback(async (silent = false) => {
    if (!siteId) return
    if (!silent) setLoading(true)
    const [slotsRes, siteRes] = await Promise.all([slotApi.getBySite(siteId), siteApi.getOne(siteId)])
    if (slotsRes.success) setSlots(slotsRes.data || {})
    if (siteRes.success) setPlacements(siteRes.data?.placements || {})
    if (!silent) setLoading(false)
  }, [siteId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    bannerApi.getAll(poolPlacement ? { placement: poolPlacement } : {}).then(r => { if (r.success) setPool(r.data || []) })
  }, [poolPlacement])
  useEffect(() => { brandApi.getAll().then(r => { if (r.success) setBrands(r.data || []) }) }, [])

  const filteredPool = useMemo(() => {
    const q = poolQuery.trim().toLowerCase()
    return q ? pool.filter(b => [b.title, b.brand_id].some(v => (v || '').toLowerCase().includes(q))) : pool
  }, [pool, poolQuery])

  const findSlot = (id: string) => Object.values(slots).flat().find(s => s.id === id)

  // Chạy 1 thao tác, báo lỗi nếu thất bại, rồi làm mới ngầm
  const run = async (task: Promise<any>) => {
    const r = await task
    if (!r?.success) notifications.show({ color: 'red', message: r?.message || 'Thao tác thất bại' })
    load(true)
  }

  const handleUpdate = (slotId: string, data: any) => run(slotApi.update(slotId, data))
  const handleReorder = (slotId: string, order: string[]) =>
    run(slotApi.setBanners(slotId, order.map((bid, i) => ({ banner_id: bid, order_in_rotation: i }))))
  const handleRemove = (slotId: string, bannerId: string) => run(slotApi.removeBanner(slotId, bannerId))

  const handleDrop = (slotId: string, banner: Banner) => {
    const slot = findSlot(slotId)
    if (!slot || slot.placement === 'button' || slot.banners.some(b => b.id === banner.id)) return
    const existing = slot.banners.map((b, i) => ({ banner_id: b.id, order_in_rotation: i }))
    run(slotApi.setBanners(slotId, [...existing, { banner_id: banner.id, order_in_rotation: existing.length }]))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveBanner(null)
    const from = active.data.current, to = over?.data.current
    if (from?.from === 'pool' && to?.slotId) handleDrop(to.slotId, from.banner)
  }

  const placementEntries = Object.entries(placements)

  return (
    <Page title="Slot Manager" description="Gán banner và nhà cái vào từng vị trí hiển thị. Kéo ảnh từ Banner Pool thả vào slot."
      actions={<SiteSwitcher value={siteId} onChange={changeSite} autoSelect />}>
      <PreviewModal banner={preview} onClose={() => setPreview(null)} />

      {!siteId ? (
        <EmptyState icon={Globe} title="Chọn site để quản lý slots" />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={e => setActiveBanner(e.active.data.current?.banner || null)} onDragEnd={handleDragEnd}>
          <Group align="flex-start" wrap="nowrap" gap="lg">
            {/* Trái: các nhóm slot */}
            <Stack gap="xl" style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <Group justify="center" py={80}><Loader size="sm" /></Group>
              ) : placementEntries.length === 0 ? (
                <EmptyState icon={Globe} title="Site chưa cấu hình placements" />
              ) : placementEntries.map(([placement, cfg]) => {
                const list = slots[placement] || []
                const color = PLACEMENT_COLORS[placement] || '#64748b'
                return (
                  <Stack key={placement} gap="sm">
                    <PlacementHeader placement={placement} cfg={cfg} slots={list} color={color} collapsed={!!collapsed[placement]}
                      onToggle={() => setCollapsed(c => ({ ...c, [placement]: !c[placement] }))} />
                    <Collapse expanded={!collapsed[placement]}>
                      <SimpleGrid cols={placement === 'slider' ? { base: 1, sm: 2, xl: 4 } : { base: 1, lg: 2 }} spacing="sm">
                        {list.map(slot => (
                          <SlotCard key={slot.id} slot={slot} color={color} brands={brands}
                            onUpdate={handleUpdate} onReorder={handleReorder} onRemoveBanner={handleRemove} onPreview={setPreview} />
                        ))}
                      </SimpleGrid>
                    </Collapse>
                  </Stack>
                )
              })}
            </Stack>

            {/* Phải: Banner Pool */}
            <Paper visibleFrom="md" w={320} p={0} pos="sticky" top={76}
              style={{ flexShrink: 0, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Stack gap="xs" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="space-between">
                  <Text fw={600}>Banner Pool</Text>
                  <Text size="xs" c="dimmed">{filteredPool.length} ảnh</Text>
                </Group>
                <SearchInput w="100%" placeholder="Tìm theo tên, brand"
                  value={poolQuery} onChange={e => setPoolQuery(e.currentTarget.value)} />
                <Select aria-label="Lọc vị trí" placeholder="Tất cả vị trí" clearable value={poolPlacement} onChange={setPoolPlacement}
                  data={POOL_PLACEMENTS.map(p => ({ value: p, label: p }))} />
              </Stack>
              <ScrollArea style={{ flex: 1 }} p="sm">
                {filteredPool.length === 0 ? (
                  <Stack align="center" gap={4} py="xl">
                    <ImageOff size={24} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" c="dimmed" ta="center">Chưa có banner. Vào Banner Pool để upload.</Text>
                  </Stack>
                ) : (
                  <SimpleGrid cols={2} spacing="xs">
                    {filteredPool.map(b => <PoolBanner key={b.id} banner={b} onPreview={setPreview} />)}
                  </SimpleGrid>
                )}
              </ScrollArea>
              <Group gap={6} px="sm" py="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <GripVertical size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">Kéo ảnh thả vào slot · Click ảnh để xem</Text>
              </Group>
            </Paper>
          </Group>

          <DragOverlay dropAnimation={null}>
            {activeBanner && (
              <ImageFrame src={activeBanner.image_url ? imgUrl(activeBanner.image_url) : null}
                style={{ width: 130, aspectRatio: '16/9', borderRadius: 'var(--mantine-radius-default)', boxShadow: 'var(--mantine-shadow-lg)' }} />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </Page>
  )
}
