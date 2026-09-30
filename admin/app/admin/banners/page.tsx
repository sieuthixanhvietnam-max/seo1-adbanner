'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon, Badge, Box, Button, Card, Checkbox, FileInput, Group, Modal, Paper, ScrollArea,
  Select, SimpleGrid, Skeleton, Stack, Table, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton,
} from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { AlertTriangle, Clock, HardDrive, Images, LayoutTemplate, Power, Sparkles, ImageOff, ImagePlus, Maximize2, Pencil, Trash2, Upload, X } from 'lucide-react'
import Page from '@/components/PageHeader'
import ImageFrame from '@/components/ui/ImageFrame'
import StatusSwitch from '@/components/ui/StatusSwitch'
import StatCard from '@/components/ui/StatCard'
import EntityCard from '@/components/ui/EntityCard'
import ViewToggle from '@/components/ui/ViewToggle'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { CardGrid, StatGrid } from '@/components/ui/Grids'
import AssignToSlotsModal from '@/components/AssignToSlotsModal'
import { useViewMode } from '@/lib/useViewMode'
import { HEAVY_BYTES, NEW_DAYS, uploadedAt, fmtSize, isHeavy, isNew, timeAgo, fullDate, formatOf, FormatBadge, AgeBadge, UploadedInfo } from '@/lib/bannerInfo'
import { PlacementIcon } from '@/lib/icons'
import { bannerApi, brandApi, imgUrl } from '@/lib/api'
import type { Banner, Brand } from '@/lib/types'
import { PLACEMENT_COLORS, PLACEMENT_ICONS } from '@/lib/types'

const PLACEMENTS = ['catfish', 'popup', 'slider', 'brand-button']
const MONO = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } }
const EMPTY_UP = { brand_id: '', placement: 'catfish', title: '', click_url: '' }

const SORTS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'size-desc', label: 'Dung lượng giảm dần' },
  { value: 'size-asc', label: 'Dung lượng tăng dần' },
  { value: 'name', label: 'Tên A-Z' },
]

function PlacementBadge({ p }: { p: string }) {
  const color = PLACEMENT_COLORS[p] || 'gray'
  return (
    <Badge variant="light" color={color} tt="none"
      leftSection={<PlacementIcon name={PLACEMENT_ICONS[p] || ''} size={12} color={PLACEMENT_COLORS[p]} />}>{p}</Badge>
  )
}

function SizeInfo({ b }: { b: Banner }) {
  const s = fmtSize(b.file_size)
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="xs" c="dimmed" ff="monospace">{s || '—'}</Text>
      {isHeavy(b) && (
        <Tooltip label="Ảnh nặng hơn 500 KB, nên nén lại để trang tải nhanh hơn">
          <Badge variant="light" color="yellow" tt="none" leftSection={<AlertTriangle size={11} />}>Nặng</Badge>
        </Tooltip>
      )}
    </Group>
  )
}

// Tỉ lệ khung ảnh theo loại vị trí (thẻ được nhóm theo placement nên cùng nhóm cùng tỉ lệ)
const STAGE_RATIO: Record<string, string> = { catfish: '3 / 1', popup: '1 / 1', slider: '16 / 9', 'brand-button': '2 / 1' }

function BannerCard({ b, brand, ratio, selected, onToggle, onPreview, onEdit, onRemove, onToggleActive }: {
  b: Banner; brand: string; ratio: string; selected: boolean
  onToggle: () => void; onPreview: () => void; onEdit: () => void; onRemove: () => void; onToggleActive: () => void
}) {
  const { hovered, ref } = useHover<HTMLDivElement>()
  const heavy = isHeavy(b)
  return (
    <EntityCard selected={selected}
      media={
        <Box pos="relative" ref={ref}>
          {/* Sân khấu ảnh: tỉ lệ cố định, ảnh hiển thị đủ (contain) không bị bóp */}
          <ImageFrame src={b.image_url ? imgUrl(b.image_url) : null} alt={b.title} onClick={onPreview}
            style={{ aspectRatio: ratio, cursor: b.image_url ? 'zoom-in' : 'default', opacity: b.is_active ? 1 : 0.5, borderBottom: '1px solid var(--mantine-color-default-border)' }} />
          <Box pos="absolute" top={8} left={8} p={4} style={{ background: 'var(--mantine-color-body)', borderRadius: 'var(--mantine-radius-default)', lineHeight: 0, opacity: selected || hovered ? 1 : 0.9 }}>
            <Checkbox checked={selected} onChange={onToggle} aria-label="Chọn banner" styles={{ input: { cursor: 'pointer' } }} />
          </Box>
          <Group gap={6} pos="absolute" top={8} right={8} wrap="nowrap">
            {isNew(b) && <Badge variant="filled" color="green">Mới</Badge>}
            {!b.is_active && <Badge variant="filled" color="dark">Đang tắt</Badge>}
          </Group>
          <Group gap={6} pos="absolute" bottom={8} left={8} wrap="nowrap">
            <FormatBadge b={b} />
            {heavy && (
              <Tooltip label="Ảnh nặng hơn 500 KB, nên nén lại để trang tải nhanh hơn">
                <Badge variant="filled" color="yellow" tt="none" leftSection={<AlertTriangle size={11} />}>Nặng</Badge>
              </Tooltip>
            )}
          </Group>
        </Box>
      }
      title={<Text fw={600} truncate>{b.title || brand || 'Chưa đặt tên'}</Text>}
      subtitle={<Text size="xs" c="dimmed" truncate>{brand ? `Brand: ${brand}` : 'Chưa gắn brand'}</Text>}
      footer={<>
        <StatusSwitch checked={!!b.is_active} onChange={onToggleActive} aria-label="Bật/tắt banner" />
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Sửa"><ActionIcon variant="subtle" color="gray" onClick={onEdit} aria-label="Sửa"><Pencil size={16} /></ActionIcon></Tooltip>
          <Tooltip label="Xóa banner"><ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="Xóa banner"><Trash2 size={16} /></ActionIcon></Tooltip>
        </Group>
      </>}>
      <Group gap={6} wrap="nowrap">
        <Clock size={13} color="var(--mantine-color-dimmed)" />
        <Tooltip label={fullDate(b) || 'Không rõ ngày upload'}><Text size="xs" c="dimmed">{timeAgo(b)}</Text></Tooltip>
        <AgeBadge b={b} />
        <Text size="xs" c="dimmed" ff="monospace" ml="auto">{fmtSize(b.file_size) || '—'}</Text>
      </Group>
    </EntityCard>
  )
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[] | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [view, setView] = useViewMode('banners', 'cards')

  const [query, setQuery] = useState('')
  const [filterPlacement, setFilterPlacement] = useState<string | null>(null)
  const [filterBrand, setFilterBrand] = useState<string | null>(null)
  const [filterFormat, setFilterFormat] = useState<string | null>(null)
  const [sort, setSort] = useState<string>('newest')

  const [preview, setPreview] = useState<Banner | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignOpen, setAssignOpen] = useState(false)

  // Upload
  const [uploadOpen, setUploadOpen] = useState(false)
  const [upForm, setUpForm] = useState(EMPTY_UP)
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit
  const [editing, setEditing] = useState<Banner | null>(null)
  const [editForm, setEditForm] = useState({ title: '', click_url: '', placement: 'catfish', brand_id: '', is_active: true })
  const [newImage, setNewImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const params: { placement?: string; brand_id?: string } = {}
      if (filterPlacement) params.placement = filterPlacement
      if (filterBrand) params.brand_id = filterBrand
      const [bRes, brRes] = await Promise.all([bannerApi.getAll(params), brandApi.getAll()])
      if (bRes.success) setBanners(bRes.data || [])
      else { setBanners(prev => prev ?? []); notifications.show({ color: 'red', message: bRes.message || 'Không tải được danh sách banner.' }) }
      if (brRes.success) setBrands(brRes.data || [])
      else notifications.show({ color: 'red', message: brRes.message || 'Không tải được danh sách brand.' })
    } catch (e: any) {
      setBanners(prev => prev ?? [])
      notifications.show({ color: 'red', message: e?.message || 'Lỗi kết nối máy chủ.' })
    }
  }, [filterPlacement, filterBrand])
  useEffect(() => { load() }, [load])

  const brandName = (id?: string) => brands.find(b => b.id === id)?.name || id || ''
  const brandOpts = useMemo(() => brands.map(b => ({ value: b.id, label: b.name })), [brands])
  const placementOpts = useMemo(() => PLACEMENTS.map(p => ({ value: p, label: p })), [])

  const formatOpts = useMemo(() => {
    const set = new Set((banners || []).map(formatOf))
    return Array.from(set).sort().map(f => ({ value: f, label: f }))
  }, [banners])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = (banners || []).filter(b => {
      if (filterFormat && formatOf(b) !== filterFormat) return false
      return !q || [b.title, b.id, brandName(b.brand_id), b.placement].some(v => (v || '').toLowerCase().includes(q))
    })
    const t = (b: Banner) => uploadedAt(b) ?? 0
    const cmp: Record<string, (a: Banner, b: Banner) => number> = {
      newest: (a, b) => t(b) - t(a),
      oldest: (a, b) => t(a) - t(b),
      'size-desc': (a, b) => (b.file_size || 0) - (a.file_size || 0),
      'size-asc': (a, b) => (a.file_size || 0) - (b.file_size || 0),
      name: (a, b) => (a.title || '').localeCompare(b.title || '', 'vi'),
    }
    return [...list].sort(cmp[sort] || cmp.newest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners, brands, query, filterFormat, sort])

  const groups = useMemo(() => {
    const map = new Map<string, Banner[]>()
    filtered.forEach(b => { const a = map.get(b.placement) || []; a.push(b); map.set(b.placement, a) })
    const order = [...PLACEMENTS, ...Array.from(map.keys()).filter(p => !PLACEMENTS.includes(p))]
    return order.filter(p => map.has(p)).map(p => ({ placement: p, items: map.get(p)! }))
  }, [filtered])

  const stats = useMemo(() => {
    const all = banners || []
    const total = all.reduce((s, b) => s + (b.file_size || 0), 0)
    return {
      total: all.length,
      active: all.filter(b => b.is_active).length,
      heavy: all.filter(isHeavy).length,
      recent: all.filter(isNew).length,
      size: fmtSize(total) || '0 KB',
    }
  }, [banners])

  // ─── Upload ────────────────────────────────────────────────────────────────
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews])

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const imgs = Array.from(list).filter(f => f.type.startsWith('image/'))
    if (imgs.length) setFiles(prev => [...prev, ...imgs])
  }
  const openUpload = () => { setUpForm(EMPTY_UP); setFiles([]); setUploadOpen(true) }

  const handleUpload = async () => {
    if (!files.length) return notifications.show({ color: 'red', message: 'Chọn ít nhất 1 ảnh!' })
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
      notifications.show({ color: 'green', message: m })
      setUploadOpen(false); setFiles([]); setUpForm(EMPTY_UP)
      load()
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Lỗi upload!' })
    } finally { setUploading(false) }
  }

  // ─── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (b: Banner) => {
    setEditing(b); setNewImage(null)
    setEditForm({ title: b.title || '', click_url: b.click_url || '', placement: b.placement, brand_id: b.brand_id || '', is_active: !!b.is_active })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await bannerApi.update(editing.id, {
        title: editForm.title, click_url: editForm.click_url, placement: editForm.placement,
        brand_id: editForm.brand_id || null, is_active: editForm.is_active,
      })
      if (!res.success) throw new Error(res.message || 'Cập nhật thất bại')
      if (newImage) {
        const fd = new FormData()
        fd.append('image', newImage)
        const ir = await bannerApi.updateImage(editing.id, fd)
        if (!ir.success) throw new Error(ir.message || 'Đổi ảnh thất bại')
      }
      notifications.show({ color: 'green', message: 'Đã cập nhật banner.' })
      setEditing(null); load()
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Lỗi!' })
    } finally { setSaving(false) }
  }

  const toggleActive = async (b: Banner) => {
    setBanners(list => (list || []).map(x => x.id === b.id ? { ...x, is_active: !x.is_active } : x))
    try {
      const res = await bannerApi.update(b.id, { is_active: !b.is_active })
      if (!res.success) notifications.show({ color: 'red', message: res.message || 'Cập nhật thất bại' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || 'Cập nhật thất bại' })
    }
    load()
  }

  // ─── Delete ────────────────────────────────────────────────────────────────
  const remove = (b: Banner) => modals.openConfirmModal({
    title: 'Xóa banner này?',
    children: <Text size="sm">Banner sẽ được chuyển vào Recycle Bin và gỡ khỏi các slot đang dùng.</Text>,
    labels: { confirm: 'Xóa banner', cancel: 'Hủy' }, confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        const res = await bannerApi.delete(b.id)
        if (res.success) {
          notifications.show({ color: 'green', message: res.detached_slots?.length ? `Đã xóa, gỡ khỏi ${res.detached_slots.length} slot` : 'Đã xóa!' })
          load()
        } else notifications.show({ color: 'red', message: res.message || 'Lỗi!' })
      } catch (e: any) {
        notifications.show({ color: 'red', message: e?.message || 'Lỗi!' })
      }
    },
  })

  // ─── Render ────────────────────────────────────────────────────────────────
  const hasFilter = !!(query.trim() || filterPlacement || filterBrand || filterFormat)
  const toggleSel = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allFilteredSelected = filtered.length > 0 && filtered.every(b => selected.has(b.id))
  const toggleAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(b => b.id)))
  const selectedBanners = (banners || []).filter(b => selected.has(b.id))
  const thumbClick = (b: Banner) => b.image_url ? setPreview(b) : undefined

  const rowActions = (b: Banner) => (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      <Tooltip label="Sửa"><ActionIcon variant="subtle" color="gray" onClick={() => openEdit(b)} aria-label="Sửa"><Pencil size={16} /></ActionIcon></Tooltip>
      <Tooltip label="Xóa banner"><ActionIcon variant="subtle" color="red" onClick={() => remove(b)} aria-label="Xóa banner"><Trash2 size={16} /></ActionIcon></Tooltip>
    </Group>
  )

  return (
    <Page title="Banner Pool" description="Kho ảnh banner dùng chung cho mọi site, gắn brand và placement rồi gán vào slot."
      actions={<Button leftSection={<Upload size={16} />} onClick={openUpload}>Upload banner</Button>}>
      <StatGrid>
        <StatCard label="Tổng banner" value={stats.total} icon={Images} loading={banners === null} hint="Trong kho ảnh" />
        <StatCard label="Đang bật" value={stats.active} of={stats.total} icon={Power} color="green" loading={banners === null} hint="Có thể gán vào slot" />
        <StatCard label={`Mới (${NEW_DAYS} ngày)`} value={stats.recent} of={stats.total} icon={Sparkles} color={stats.recent ? 'teal' : 'gray'} loading={banners === null} hint="Upload gần đây" />
        <StatCard label="Ảnh nặng" value={stats.heavy} of={stats.total} icon={AlertTriangle} color={stats.heavy ? 'yellow' : 'gray'} loading={banners === null} hint="Trên 500 KB" />
        <StatCard label="Tổng dung lượng" value={stats.size} icon={HardDrive} color="gray" loading={banners === null} hint="Lưu trên R2" />
      </StatGrid>

      <Group justify="space-between" wrap="wrap">
        <Group wrap="wrap">
          <SearchInput placeholder="Tìm theo tiêu đề, brand, ID"
            value={query} onChange={e => setQuery(e.currentTarget.value)} />
          <Select w={{ base: '100%', xs: 170 }} placeholder="Tất cả vị trí" data={placementOpts} value={filterPlacement} onChange={setFilterPlacement} clearable />
          <Select w={{ base: '100%', xs: 130 }} placeholder="Định dạng" data={formatOpts} value={filterFormat} onChange={setFilterFormat} clearable />
          <Select w={{ base: '100%', xs: 170 }} placeholder="Tất cả brand" data={brandOpts} value={filterBrand} onChange={setFilterBrand} clearable searchable />
        </Group>
        <Group wrap="wrap">
        <Select w={{ base: '100%', xs: 190 }} aria-label="Sắp xếp" data={SORTS} value={sort} onChange={v => setSort(v || 'newest')} allowDeselect={false} />
        <ViewToggle value={view} onChange={setView} />
        </Group>
      </Group>

      {selected.size > 0 && (
        <Paper p="sm" pos="sticky" top={68} style={{ zIndex: 20, borderColor: 'var(--mantine-primary-color-filled)' }}>
          <Group justify="space-between" wrap="wrap">
            <Text size="sm" fw={600}>Đã chọn {selected.size} banner</Text>
            <Group gap="xs">
              <Button variant="default" onClick={toggleAll}>{allFilteredSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${filtered.length})`}</Button>
              <Button variant="default" onClick={() => setSelected(new Set())}>Xóa lựa chọn</Button>
              <Button leftSection={<LayoutTemplate size={16} />} onClick={() => setAssignOpen(true)}>Gán vào slot</Button>
            </Group>
          </Group>
        </Paper>
      )}

      {banners === null ? (
        <CardGrid>{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={320} />)}</CardGrid>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ImageOff}
          title={hasFilter ? 'Không có banner khớp bộ lọc' : 'Chưa có banner'}
          description={hasFilter ? 'Thử đổi từ khóa, vị trí hoặc brand.' : 'Upload ảnh để bắt đầu xây pool banner.'}
          action={!hasFilter ? <Button mt="sm" leftSection={<Upload size={16} />} onClick={openUpload}>Upload banner</Button> : undefined} />
      ) : view === 'table' ? (
        <Paper>
          <Table.ScrollContainer minWidth={1040}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}><Checkbox checked={allFilteredSelected} indeterminate={selected.size > 0 && !allFilteredSelected} onChange={toggleAll} aria-label="Chọn tất cả" /></Table.Th><Table.Th w={88}>Ảnh</Table.Th><Table.Th>Banner</Table.Th><Table.Th>Vị trí</Table.Th><Table.Th>Brand</Table.Th>
                  <Table.Th>Định dạng</Table.Th><Table.Th>Dung lượng</Table.Th><Table.Th>Ngày upload</Table.Th><Table.Th w={110}>Trạng thái</Table.Th><Table.Th w={96} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(b => (
                  <Table.Tr key={b.id} bg={selected.has(b.id) ? 'var(--mantine-primary-color-light)' : undefined}>
                    <Table.Td><Checkbox checked={selected.has(b.id)} onChange={() => toggleSel(b.id)} aria-label="Chọn banner" /></Table.Td>
                    <Table.Td>
                      <ImageFrame src={b.image_url ? imgUrl(b.image_url) : null} alt={b.title} onClick={() => thumbClick(b)}
                        style={{ width: 64, height: 40, borderRadius: 4, border: '1px solid var(--mantine-color-default-border)', cursor: b.image_url ? 'zoom-in' : 'default' }} />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size="sm" lineClamp={1}>{b.title || '(không có tiêu đề)'}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">{b.id.slice(0, 8)}</Text>
                    </Table.Td>
                    <Table.Td><PlacementBadge p={b.placement} /></Table.Td>
                    <Table.Td>{b.brand_id ? brandName(b.brand_id) : <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td><FormatBadge b={b} /></Table.Td>
                    <Table.Td><SizeInfo b={b} /></Table.Td>
                    <Table.Td><UploadedInfo b={b} /></Table.Td>
                    <Table.Td><StatusSwitch checked={!!b.is_active} onChange={() => toggleActive(b)} aria-label="Bật/tắt banner" /></Table.Td>
                    <Table.Td>{rowActions(b)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : (
        <Stack gap="xl">
          {groups.map(({ placement, items }) => (
            <Stack key={placement} gap="sm">
              <Group gap="xs">
                <PlacementBadge p={placement} />
                <Text size="sm" c="dimmed">{items.length} banner</Text>
              </Group>
              <CardGrid>
                {items.map(b => (
                  <BannerCard key={b.id} b={b} ratio={STAGE_RATIO[placement] || '16 / 10'} brand={b.brand_id ? brandName(b.brand_id) : ''} selected={selected.has(b.id)}
                    onToggle={() => toggleSel(b.id)} onPreview={() => thumbClick(b)} onEdit={() => openEdit(b)}
                    onRemove={() => remove(b)} onToggleActive={() => toggleActive(b)} />
                ))}
              </CardGrid>
            </Stack>
          ))}
        </Stack>
      )}

      <AssignToSlotsModal opened={assignOpen} banners={selectedBanners} onClose={() => setAssignOpen(false)} onDone={() => setSelected(new Set())} />

      {/* Xem ảnh đầy đủ */}
      <Modal opened={!!preview} onClose={() => setPreview(null)} size="xl" title={preview?.title || 'Xem banner'}>
        {preview && (
          <Stack>
            <ImageFrame natural src={preview.image_url ? imgUrl(preview.image_url) : null} alt={preview.title}
              style={{ minHeight: 200, maxHeight: '65vh', padding: 12, borderRadius: 4, border: '1px solid var(--mantine-color-default-border)' }} />
            <Group gap="xs">
              <PlacementBadge p={preview.placement} />
              {preview.brand_id && <Text size="sm" fw={600}>{brandName(preview.brand_id)}</Text>}
              <SizeInfo b={preview} />
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Upload */}
      <Modal opened={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} size="lg" title="Upload banner (nhiều ảnh)"
        scrollAreaComponent={ScrollArea.Autosize}>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Vị trí (placement)" data={placementOpts} value={upForm.placement} allowDeselect={false}
              onChange={v => setUpForm(f => ({ ...f, placement: v || 'catfish' }))} />
            <Select label="Brand (tùy chọn)" placeholder="Không gắn brand" data={brandOpts} value={upForm.brand_id || null} clearable searchable
              onChange={v => setUpForm(f => ({ ...f, brand_id: v || '' }))} />
          </SimpleGrid>
          <TextInput label="Click URL" description="Để trống = dùng URL brand" placeholder="(tùy chọn)" styles={MONO}
            value={upForm.click_url} onChange={e => { const v = e.currentTarget.value; setUpForm(f => ({ ...f, click_url: v })) }} />

          <Box>
            <Text size="sm" fw={500} mb={4}>Ảnh (kéo-thả hoặc chọn nhiều)</Text>
            <UnstyledButton
              w="100%"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files) }}
              style={{
                border: `2px dashed ${dragActive ? 'var(--mantine-color-brand-filled)' : 'var(--mantine-color-default-border)'}`,
                borderRadius: 'var(--mantine-radius-default)', padding: 'var(--mantine-spacing-lg)',
                background: dragActive ? 'var(--mantine-color-default-hover)' : 'var(--mantine-color-default)',
              }}
            >
              <Stack align="center" gap={4}>
                <ThemeIcon variant="light" size={40} radius="xl"><ImagePlus size={20} strokeWidth={1.8} /></ThemeIcon>
                <Text size="sm" fw={500}>Kéo-thả ảnh vào đây, hoặc bấm để chọn</Text>
                <Text size="xs" c="dimmed">jpg, png, gif, webp · tối đa 5MB/ảnh</Text>
              </Stack>
            </UnstyledButton>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          </Box>

          {files.length > 0 && (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">{files.length} ảnh đã chọn</Text>
                <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setFiles([])}>Bỏ chọn tất cả</Button>
              </Group>
              <SimpleGrid cols={{ base: 2, xs: 3, sm: 4 }} spacing="xs">
                {files.map((f, i) => (
                  <Box key={`${f.name}-${i}`} pos="relative">
                    <ImageFrame src={previews[i]} alt={f.name}
                      style={{ aspectRatio: '1', borderRadius: 4, border: '1px solid var(--mantine-color-default-border)' }} />
                    <Tooltip label="Bỏ ảnh">
                      <ActionIcon pos="absolute" top={4} right={4} size="sm" variant="default" aria-label="Bỏ ảnh"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}><X size={12} /></ActionIcon>
                    </Tooltip>
                    <Group gap={4} mt={2} wrap="nowrap">
                      <Text size="xs" c={f.size > HEAVY_BYTES ? 'yellow.8' : 'dimmed'} ff="monospace">{fmtSize(f.size)}</Text>
                      {f.size > HEAVY_BYTES && <AlertTriangle size={11} color="var(--mantine-color-yellow-6)" />}
                    </Group>
                  </Box>
                ))}
              </SimpleGrid>
            </Stack>
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setUploadOpen(false)} disabled={uploading}>Hủy</Button>
            <Button onClick={handleUpload} loading={uploading} leftSection={<Upload size={16} />}>Upload</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Sửa banner */}
      <Modal opened={!!editing} onClose={() => !saving && setEditing(null)} size="lg" title="Sửa banner"
        scrollAreaComponent={ScrollArea.Autosize}>
        {editing && (
          <Stack>
            <Group align="flex-start" wrap="nowrap">
              <ImageFrame src={editing.image_url ? imgUrl(editing.image_url) : null} alt={editing.title}
                style={{ width: 140, height: 90, flexShrink: 0, borderRadius: 4, border: '1px solid var(--mantine-color-default-border)' }} />
              <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
                <FileInput label="Thay ảnh" description="Chọn ảnh mới để thay thế ảnh hiện tại" placeholder="Chọn ảnh..." accept="image/*" clearable
                  leftSection={<ImagePlus size={16} />} value={newImage} onChange={setNewImage} />
                <Group gap="xs">
                  <SizeInfo b={editing} />
                  {newImage && <Text size="xs" c="dimmed">Ảnh mới: <Text span ff="monospace" c={newImage.size > HEAVY_BYTES ? 'yellow.8' : undefined}>{fmtSize(newImage.size)}</Text></Text>}
                </Group>
              </Stack>
            </Group>
            <TextInput label="Tiêu đề" value={editForm.title} onChange={e => { const v = e.currentTarget.value; setEditForm(f => ({ ...f, title: v })) }} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select label="Vị trí (placement)" data={placementOpts.some(o => o.value === editForm.placement) ? placementOpts : [...placementOpts, { value: editForm.placement, label: editForm.placement }]}
                value={editForm.placement} allowDeselect={false} onChange={v => setEditForm(f => ({ ...f, placement: v || f.placement }))} />
              <Select label="Brand" placeholder="Không gắn brand" data={brandOpts} value={editForm.brand_id || null} clearable searchable
                onChange={v => setEditForm(f => ({ ...f, brand_id: v || '' }))} />
            </SimpleGrid>
            <TextInput label="Click URL" description="Để trống = dùng URL brand" styles={MONO} value={editForm.click_url}
              onChange={e => { const v = e.currentTarget.value; setEditForm(f => ({ ...f, click_url: v })) }} />
            <StatusSwitch checked={editForm.is_active} label="Đang bật" onChange={e => { const v = e.currentTarget.checked; setEditForm(f => ({ ...f, is_active: v })) }} />
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => setEditing(null)} disabled={saving}>Hủy</Button>
              <Button onClick={handleSave} loading={saving}>Lưu</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Page>
  )
}
