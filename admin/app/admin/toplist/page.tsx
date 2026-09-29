'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Box, Button, FileButton, FileInput, Group, Modal, Paper, Select, Skeleton, Stack, Text,
  ThemeIcon, Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { GripVertical, Info, ImagePlus, LayoutList, Plus, Trash2, Trophy, Upload } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Page from '@/components/PageHeader'
import SiteSwitcher from '@/components/SiteSwitcher'
import ImageFrame from '@/components/ui/ImageFrame'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import { StatGrid } from '@/components/ui/Grids'
import { toplistApi, brandApi, imgUrl } from '@/lib/api'

interface TLEntry {
  id: string; brand_id: string; rank: number; name: string
  login_url: string; image_url: string; is_active: boolean
}
interface Brand { id: string; name: string }

const MEDAL: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }

// ─── Dòng toplist (kéo thả được) ──────────────────────────────────────────────
function SortableRow({ entry, onDelete, onChangeImage }: {
  entry: TLEntry; onDelete: (e: TLEntry) => void; onChangeImage: (id: string, file: File) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const medal = MEDAL[entry.rank]

  return (
    <Paper ref={setNodeRef} p="sm" shadow="xs" style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : 1, position: 'relative',
      boxShadow: isDragging ? 'var(--mantine-shadow-lg)' : undefined,
    }}>
      <Group wrap="nowrap" gap="sm">
        <Box {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', touchAction: 'none', color: 'var(--mantine-color-dimmed)' }}>
          <GripVertical size={18} />
        </Box>

        <ThemeIcon size={40} radius="md" variant={medal ? 'filled' : 'light'} color={medal ? undefined : 'brand'}
          style={medal ? { background: medal, color: '#000' } : undefined}>
          <Text fw={700} fz="sm">#{entry.rank}</Text>
        </ThemeIcon>

        <ImageFrame src={entry.image_url ? imgUrl(entry.image_url) : null} alt={entry.name}
          w={88} h={50} style={{ flexShrink: 0, borderRadius: 'var(--mantine-radius-default)', border: '1px solid var(--mantine-color-default-border)' }} />

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} truncate>{entry.name}</Text>
          <Text size="xs" c="dimmed" ff="monospace" truncate>{entry.login_url || '(chưa có link)'}</Text>
        </Box>

        <Group gap={4} wrap="nowrap">
          <FileButton accept="image/*" onChange={f => f && onChangeImage(entry.id, f)}>
            {props => (
              <>
                <Button {...props} variant="default" leftSection={<ImagePlus size={16} />} visibleFrom="sm">Đổi ảnh</Button>
                <Tooltip label="Đổi ảnh">
                  <ActionIcon {...props} variant="subtle" color="gray" hiddenFrom="sm" aria-label="Đổi ảnh"><ImagePlus size={16} /></ActionIcon>
                </Tooltip>
              </>
            )}
          </FileButton>
          <Tooltip label="Xóa khỏi toplist">
            <ActionIcon variant="subtle" color="red" onClick={() => onDelete(entry)} aria-label="Xóa khỏi toplist"><Trash2 size={16} /></ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}

// ─── Trang ────────────────────────────────────────────────────────────────────
export default function ToplistPage() {
  // Bắt đầu rỗng để server & client render khớp nhau; đọc localStorage sau khi mount
  const [siteId, setSiteId] = useState('')
  const [entries, setEntries] = useState<TLEntry[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addBrand, setAddBrand] = useState<string | null>(null)
  const [addFile, setAddFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    try { const s = localStorage.getItem('active_site'); if (s) setSiteId(s) } catch {}
  }, [])
  const handleSiteChange = (id: string) => { setSiteId(id); try { localStorage.setItem('active_site', id) } catch {} }

  const load = useCallback(async (silent = false) => {
    if (!siteId) return
    if (!silent) setLoading(true)
    try {
      const [tRes, bRes] = await Promise.all([toplistApi.getBySite(siteId), brandApi.getAll()])
      if (tRes.success) setEntries(tRes.data || [])
      else notifications.show({ color: 'red', message: tRes.message || 'Không tải được toplist' })
      if (bRes.success) setBrands(bRes.data || [])
      else notifications.show({ color: 'red', message: bRes.message || 'Không tải được danh sách brand' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || 'Không tải được dữ liệu' })
    } finally { if (!silent) setLoading(false) }
  }, [siteId])
  useEffect(() => { load() }, [load])

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIdx = entries.findIndex(x => x.id === active.id)
    const newIdx = entries.findIndex(x => x.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(entries, oldIdx, newIdx).map((x, i) => ({ ...x, rank: i + 1 }))
    setEntries(reordered)
    const res = await toplistApi.reorder(siteId, reordered.map(x => x.id))
    if (!res.success) {
      notifications.show({ color: 'red', message: res.message || 'Lưu thứ hạng thất bại' })
      load(true)
    }
  }

  const closeAdd = () => { setShowAdd(false); setAddBrand(null); setAddFile(null) }

  const handleAdd = async () => {
    if (!addBrand) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('site_id', siteId)
      fd.append('brand_id', addBrand)
      if (addFile) fd.append('image', addFile)
      const res = await toplistApi.create(fd)
      if (res.success) {
        closeAdd(); load(true)
        notifications.show({ color: 'green', message: 'Đã thêm vào toplist.' })
      } else notifications.show({ color: 'red', message: res.message || 'Thêm thất bại' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || 'Thêm thất bại' })
    } finally { setSaving(false) }
  }

  const handleDelete = (e: TLEntry) => modals.openConfirmModal({
    title: `Xóa "${e.name}" khỏi toplist?`,
    children: <Text size="sm">Mục này sẽ bị gỡ khỏi bảng xếp hạng của site.</Text>,
    labels: { confirm: 'Xóa khỏi toplist', cancel: 'Hủy' }, confirmProps: { color: 'red' },
    onConfirm: async () => {
      const res = await toplistApi.delete(e.id)
      if (res.success) notifications.show({ color: 'green', message: 'Đã xóa khỏi toplist.' })
      else notifications.show({ color: 'red', message: res.message || 'Xóa thất bại' })
      load(true)
    },
  })

  const handleChangeImage = async (id: string, file: File) => {
    try {
      const fd = new FormData(); fd.append('image', file)
      const res = await toplistApi.update(id, fd)
      if (res.success) notifications.show({ color: 'green', message: 'Đã đổi ảnh.' })
      else notifications.show({ color: 'red', message: res.message || 'Đổi ảnh thất bại' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || 'Đổi ảnh thất bại' })
    }
    load(true)
  }

  const availableBrands = useMemo(() => brands.filter(b => !entries.some(e => e.brand_id === b.id)), [brands, entries])

  const actions = (
    <>
      <SiteSwitcher value={siteId} onChange={handleSiteChange} />
      {siteId && <Button leftSection={<Plus size={16} />} onClick={() => setShowAdd(true)}>Thêm nhà cái</Button>}
    </>
  )

  return (
    <Page title="Toplist" description="Bảng xếp hạng nhà cái hiển thị trên từng site." actions={actions}>
      {!siteId ? (
        <EmptyState icon={Trophy} title="Chọn site để quản lý toplist" />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Nhà cái trong toplist" icon={Trophy} loading={loading} value={entries.length} of={entries.length + availableBrands.length}
              hint={entries.length > 0 ? 'Đang xếp hạng trên site' : 'Chưa có mục nào'} />
            <StatCard label="Brand chưa thêm" icon={LayoutList} color={availableBrands.length > 0 ? 'yellow' : 'green'} loading={loading}
              value={availableBrands.length} hint={availableBrands.length > 0 ? 'Có thể thêm vào toplist' : 'Đã thêm đủ brand'} />
          </StatGrid>

          {loading ? (
            <Stack gap="xs">{[0, 1, 2, 3].map(i => <Skeleton key={i} h={68} />)}</Stack>
          ) : entries.length === 0 ? (
            <EmptyState icon={Trophy} title="Chưa có nhà cái" description="Thêm nhà cái để tạo bảng xếp hạng."
              action={<Button mt="sm" leftSection={<Plus size={16} />} onClick={() => setShowAdd(true)}>Thêm nhà cái</Button>} />
          ) : (
            <Stack gap="sm">
              <Group gap={6} c="dimmed">
                <Info size={14} />
                <Text size="sm" c="dimmed">Kéo để đổi thứ hạng. Mô tả đánh giá do WordPress tự nhập.</Text>
              </Group>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
                  <Stack gap="xs">
                    {entries.map(entry => (
                      <SortableRow key={entry.id} entry={entry} onDelete={handleDelete} onChangeImage={handleChangeImage} />
                    ))}
                  </Stack>
                </SortableContext>
              </DndContext>
            </Stack>
          )}
        </>
      )}

      <Modal opened={showAdd} onClose={closeAdd} title="Thêm nhà cái vào toplist">
        <Stack>
          <Select label="Chọn brand" placeholder="Chọn nhà cái" searchable nothingFoundMessage="Không tìm thấy brand"
            data={availableBrands.map(b => ({ value: b.id, label: b.name }))} value={addBrand} onChange={setAddBrand}
            error={availableBrands.length === 0 ? 'Tất cả brand đã có trong toplist' : undefined} />
          <FileInput label="Ảnh riêng cho toplist" description="Banner ngang, tùy chọn. Bỏ trống = dùng logo brand"
            accept="image/*" clearable placeholder="Chọn ảnh" leftSection={<Upload size={16} />}
            value={addFile} onChange={setAddFile} />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={closeAdd}>Hủy</Button>
            <Button onClick={handleAdd} loading={saving} disabled={!addBrand}>Thêm</Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  )
}
