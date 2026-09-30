'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Badge, Button, Chip, Code, Grid, Group, Modal, NumberInput, 
  ScrollArea, SegmentedControl, Select, Skeleton, Stack, Table, Text, TextInput,
  Paper, Textarea, ThemeIcon, Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { Globe, Pencil, Plus, Power, PowerOff, Trash2, Upload } from 'lucide-react'
import Page from '@/components/PageHeader'
import { siteApi, getBaseUrl, jsonHeaders } from '@/lib/api'
import type { Site } from '@/lib/types'
import { PLACEMENT_COLORS } from '@/lib/types'
import { useViewMode } from '@/lib/useViewMode'
import StatusSwitch from '@/components/ui/StatusSwitch'
import StatCard from '@/components/ui/StatCard'
import EntityCard from '@/components/ui/EntityCard'
import ViewToggle from '@/components/ui/ViewToggle'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { StatGrid, CardGrid } from '@/components/ui/Grids'

const BULK_SAMPLE = JSON.stringify([
  {
    id: 'nganh-g', name: 'Ngành G', domain: 'nganh-g.com',
    placements: {
      catfish: { label: 'Catfish', limit: 4, default_mode: 'rotate' },
      button:  { label: 'Nút bấm', limit: 2, default_mode: 'fixed' },
      popup:   { label: 'Popup',   limit: 1, default_mode: 'fixed' },
    },
  },
], null, 2)

const TEMPLATES: Record<string, Record<string, any>> = {
  nganh: {
    catfish: { label: 'Catfish', limit: 4, default_mode: 'rotate' },
    button:  { label: 'Nút bấm', limit: 2, default_mode: 'fixed' },
    popup:   { label: 'Popup',   limit: 1, default_mode: 'fixed' },
  },
  phishing: {
    slider:  { label: 'Slider',  limit: 10, default_mode: 'rotate' },
    catfish: { label: 'Catfish', limit: 4,  default_mode: 'rotate' },
    button:  { label: 'Nút bấm', limit: 2,  default_mode: 'fixed' },
    popup:   { label: 'Popup',   limit: 1,  default_mode: 'fixed' },
  },
  brand: { 'brand-button': { label: 'Brand Button', limit: 0, default_mode: 'fixed' } },
}

const MODE_OPTS = [{ value: 'fixed', label: 'Fixed' }, { value: 'rotate', label: 'Rotate' }]
const MONO = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } }

interface PRow { key: string; label: string; limit: number; default_mode: string }

const placementsToRows = (obj: Record<string, any>): PRow[] =>
  Object.entries(obj || {}).map(([key, cfg]) => ({
    key, label: cfg.label || '', limit: cfg.limit ?? 0, default_mode: cfg.default_mode || 'fixed',
  }))

const rowsToPlacements = (rows: PRow[]) => {
  const out: Record<string, any> = {}
  rows.forEach(r => {
    const k = r.key.trim()
    if (k) out[k] = { label: r.label || k, limit: Number(r.limit) || 0, default_mode: r.default_mode }
  })
  return out
}

function PlacementBadges({ site }: { site: Site }) {
  const entries = Object.entries(site.placements || {})
  if (!entries.length) return <Text c="dimmed" size="sm">—</Text>
  return (
    <Group gap={6}>
      {entries.map(([p, cfg]) => (
        <Badge key={p} variant="light" color={PLACEMENT_COLORS[p] || 'gray'} tt="none">{cfg.label} · {cfg.limit}</Badge>
      ))}
    </Group>
  )
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[] | null>(null)
  const [view, setView] = useViewMode('sites', 'table')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'on' | 'off'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [form, setForm] = useState({ id: '', name: '', domain: '', site_type: '', template: 'nganh', placements: '' })
  const [pmode, setPmode] = useState<'manual' | 'json'>('manual')
  const [rows, setRows] = useState<PRow[]>([])
  const [saving, setSaving] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulking, setBulking] = useState(false)

  const load = () => siteApi.getAll().then(r => { if (r.success) setSites(r.data || []); else setSites([]) })
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const all = sites || []
    return { total: all.length, on: all.filter(s => s.is_active).length, off: all.filter(s => !s.is_active).length }
  }, [sites])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (sites || []).filter(s => {
      if (status === 'on' && !s.is_active) return false
      if (status === 'off' && s.is_active) return false
      return !q || [s.name, s.id, s.domain].some(v => (v || '').toLowerCase().includes(q))
    })
  }, [sites, query, status])

  // ─── Form ──────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditSite(null); setPmode('manual')
    setForm({ id: '', name: '', domain: '', site_type: '', template: 'nganh', placements: JSON.stringify(TEMPLATES.nganh, null, 2) })
    setRows(placementsToRows(TEMPLATES.nganh))
    setFormOpen(true)
  }
  const openEdit = (s: Site) => {
    setEditSite(s); setPmode('manual')
    setForm({ id: s.id, name: s.name, domain: s.domain || '', site_type: s.site_type || '', template: '', placements: JSON.stringify(s.placements, null, 2) })
    setRows(placementsToRows(s.placements as any))
    setFormOpen(true)
  }
  const setTemplate = (t: string) => {
    setForm(f => ({ ...f, template: t, placements: JSON.stringify(TEMPLATES[t] || {}, null, 2) }))
    setRows(placementsToRows(TEMPLATES[t] || {}))
  }
  const switchMode = (m: 'manual' | 'json') => {
    if (m === pmode) return
    if (m === 'json') {
      setForm(f => ({ ...f, placements: JSON.stringify(rowsToPlacements(rows), null, 2) }))
    } else {
      try { setRows(placementsToRows(JSON.parse(form.placements))) }
      catch { notifications.show({ color: 'red', message: 'JSON hiện không hợp lệ, không thể chuyển sang thủ công.' }); return }
    }
    setPmode(m)
  }
  const updateRow = (i: number, patch: Partial<PRow>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const submit = async () => {
    if (!editSite && !form.id.trim()) return notifications.show({ color: 'red', message: 'ID (slug) là bắt buộc.' })
    if (!form.name.trim()) return notifications.show({ color: 'red', message: 'Tên site là bắt buộc.' })

    let placements: Record<string, any>
    if (pmode === 'manual') {
      placements = rowsToPlacements(rows)
      if (!Object.keys(placements).length) return notifications.show({ color: 'red', message: 'Cần ít nhất 1 placement.' })
    } else {
      try { placements = JSON.parse(form.placements) }
      catch { return notifications.show({ color: 'red', message: 'Placements JSON không hợp lệ.' }) }
    }

    const base = { name: form.name, domain: form.domain, site_type: form.site_type, placements }
    setSaving(true)
    try {
      let res = editSite ? await siteApi.update(editSite.id, base) : await siteApi.create({ id: form.id, ...base })
      // Giảm limit làm mất slot đang có banner → hỏi xác nhận rồi gửi lại với force
      if (!res.success && (res as any).conflicts?.length && editSite) {
        const ok = await new Promise<boolean>(resolve => modals.openConfirmModal({
          title: 'Xóa slot đang có banner?',
          children: <Text size="sm">{res.message} Các slot vượt limit mới sẽ bị xóa cùng banner đã gán.</Text>,
          labels: { confirm: 'Xóa slot', cancel: 'Hủy' }, confirmProps: { color: 'red' },
          onConfirm: () => resolve(true), onCancel: () => resolve(false), onClose: () => resolve(false),
        }))
        if (ok) res = await siteApi.update(editSite.id, { ...base, force: true })
        else return
      }
      if (res.success) {
        setFormOpen(false); load()
        notifications.show({ color: 'green', message: editSite ? 'Đã cập nhật site.' : 'Đã tạo site.' })
      } else notifications.show({ color: 'red', message: res.message || 'Lỗi!' })
    } finally { setSaving(false) }
  }

  const toggleActive = async (s: Site) => {
    setSites(list => (list || []).map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
    const res = await siteApi.update(s.id, { is_active: !s.is_active })
    if (!res.success) notifications.show({ color: 'red', message: res.message || 'Cập nhật thất bại' })
    load()
  }

  const remove = (s: Site) => modals.openConfirmModal({
    title: `Xóa site "${s.name}"?`,
    children: <Text size="sm">Toàn bộ slots của site này sẽ bị xóa. Hành động không thể hoàn tác.</Text>,
    labels: { confirm: 'Xóa site', cancel: 'Hủy' }, confirmProps: { color: 'red' },
    onConfirm: async () => {
      const res = await siteApi.delete(s.id)
      if (res.success) { notifications.show({ color: 'green', message: 'Đã xóa site.' }); load() }
      else notifications.show({ color: 'red', message: res.message || 'Xóa thất bại' })
    },
  })

  const handleBulkImport = async () => {
    let arr: any[]
    try { arr = JSON.parse(bulkJson); if (!Array.isArray(arr)) throw new Error('Phải là mảng JSON') }
    catch (e: any) { return notifications.show({ color: 'red', message: 'JSON không hợp lệ: ' + e.message }) }
    setBulking(true)
    try {
      const res = await fetch(`${getBaseUrl()}/api/sites/bulk`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ sites: arr }),
      }).then(r => r.json())
      if (res.success) {
        notifications.show({ color: 'green', message: res.message || 'Đã import!' })
        setBulkOpen(false); setBulkJson(''); load()
      } else notifications.show({ color: 'red', message: res.message || 'Lỗi import!' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Lỗi import!' })
    } finally { setBulking(false) }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const actions = (
    <>
      <Button variant="default" leftSection={<Upload size={16} />} onClick={() => setBulkOpen(true)}>Import JSON</Button>
      <Button leftSection={<Plus size={16} />} onClick={openCreate}>Thêm site</Button>
    </>
  )

  return (
    <Page title="Sites" description="Các website WordPress nhận banner và cấu hình placement của từng site." actions={actions}>
      <StatGrid>
        <StatCard label="Tổng số site" value={stats.total} icon={Globe} loading={sites === null} hint="Website WordPress đã đăng ký" />
        <StatCard label="Đang bật" value={stats.on} of={stats.total} icon={Power} color="green" loading={sites === null} hint="Đang nhận banner" />
        <StatCard label="Đã tắt" value={stats.off} of={stats.total} icon={PowerOff} color="gray" loading={sites === null} hint="Tạm ngưng hiển thị" />
      </StatGrid>

      <Group justify="space-between" wrap="wrap">
        <Group wrap="wrap">
          <SearchInput placeholder="Tìm theo tên, ID, domain"
            value={query} onChange={e => setQuery(e.currentTarget.value)} />
          <SegmentedControl value={status} onChange={v => setStatus(v as any)}
            data={[{ value: 'all', label: 'Tất cả' }, { value: 'on', label: 'Đang bật' }, { value: 'off', label: 'Đã tắt' }]} />
        </Group>
        <ViewToggle value={view} onChange={setView} />
      </Group>

      {sites === null ? (
        <Stack>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={52} />)}</Stack>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Globe}
          title={sites.length === 0 ? 'Chưa có site nào' : 'Không có site khớp bộ lọc'}
          description={sites.length === 0 ? 'Tạo site đầu tiên để bắt đầu cấu hình banner.' : 'Thử đổi từ khóa hoặc trạng thái.'}
          action={sites.length === 0 ? <Button mt="sm" leftSection={<Plus size={16} />} onClick={openCreate}>Thêm site</Button> : undefined} />
      ) : view === 'table' ? (
        <Paper>
          <Table.ScrollContainer minWidth={820}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Site</Table.Th><Table.Th>Domain</Table.Th><Table.Th>Placements</Table.Th>
                  <Table.Th w={110}>Trạng thái</Table.Th><Table.Th w={96} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(s => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <Text fw={600}>{s.name}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">{s.id}</Text>
                    </Table.Td>
                    <Table.Td>{s.domain ? <Code>{s.domain}</Code> : <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td><PlacementBadges site={s} /></Table.Td>
                    <Table.Td>
                      <StatusSwitch checked={!!s.is_active} onChange={() => toggleActive(s)} aria-label={`Bật/tắt ${s.name}`} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Sửa site"><ActionIcon variant="subtle" color="gray" onClick={() => openEdit(s)} aria-label="Sửa site"><Pencil size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Xóa site"><ActionIcon variant="subtle" color="red" onClick={() => remove(s)} aria-label="Xóa site"><Trash2 size={16} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : (
        <CardGrid>
          {filtered.map(s => (
            <EntityCard key={s.id} dimmed={!s.is_active}
              leading={<ThemeIcon size={34} variant="light" radius="md"><Globe size={17} strokeWidth={1.8} /></ThemeIcon>}
              title={s.name} subtitle={s.id}
              status={<StatusSwitch checked={!!s.is_active} onChange={() => toggleActive(s)} aria-label={`Bật/tắt ${s.name}`} />}
              footer={<>
                {s.domain ? <Code>{s.domain}</Code> : <Text size="sm" c="dimmed">Chưa gắn domain</Text>}
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Sửa site"><ActionIcon variant="subtle" color="gray" onClick={() => openEdit(s)} aria-label="Sửa site"><Pencil size={16} /></ActionIcon></Tooltip>
                  <Tooltip label="Xóa site"><ActionIcon variant="subtle" color="red" onClick={() => remove(s)} aria-label="Xóa site"><Trash2 size={16} /></ActionIcon></Tooltip>
                </Group>
              </>}>
              <Stack gap={6}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Placements</Text>
                <PlacementBadges site={s} />
              </Stack>
            </EntityCard>
          ))}
        </CardGrid>
      )}

      {/* Thêm / sửa site */}
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} size="xl" title={editSite ? `Sửa site: ${editSite.name}` : 'Thêm site mới'}
        scrollAreaComponent={ScrollArea.Autosize}>
        <Stack>
          <Grid>
            {!editSite && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput label="ID (slug)" required value={form.id} placeholder="nganh-g" styles={MONO}
                  onChange={e => { const v = e.currentTarget.value; setForm(f => ({ ...f, id: v })) }} />
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, sm: editSite ? 12 : 6 }}>
              <TextInput label="Tên site" required value={form.name} placeholder="Ngành G"
                onChange={e => { const v = e.currentTarget.value; setForm(f => ({ ...f, name: v })) }} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Domain WordPress" description="Tùy chọn, dùng để tự nhận diện site" value={form.domain} placeholder="nganh-g.com" styles={MONO}
                onChange={e => { const v = e.currentTarget.value; setForm(f => ({ ...f, domain: v })) }} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Site type" description="Tùy chọn" value={form.site_type} placeholder="nganh-g" styles={MONO}
                onChange={e => { const v = e.currentTarget.value; setForm(f => ({ ...f, site_type: v })) }} />
            </Grid.Col>
          </Grid>

          {!editSite && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>Template nhanh</Text>
              <Chip.Group multiple={false} value={form.template} onChange={v => v && setTemplate(v as string)}>
                <Group gap="xs">{Object.keys(TEMPLATES).map(t => <Chip key={t} value={t} tt="capitalize">{t}</Chip>)}</Group>
              </Chip.Group>
            </Stack>
          )}

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>Placements</Text>
              <SegmentedControl value={pmode} onChange={v => switchMode(v as any)}
                data={[{ value: 'manual', label: 'Thủ công' }, { value: 'json', label: 'JSON' }]} />
            </Group>

            {pmode === 'manual' ? (
              <Stack gap="xs">
                {rows.map((row, i) => (
                  <Grid key={i} align="flex-end" gap="xs">
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <TextInput label={i === 0 ? 'Key' : undefined} value={row.key} placeholder="catfish" styles={MONO}
                        onChange={e => updateRow(i, { key: e.currentTarget.value })} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <TextInput label={i === 0 ? 'Nhãn' : undefined} value={row.label} placeholder="Catfish"
                        onChange={e => updateRow(i, { label: e.currentTarget.value })} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 4, sm: 2 }}>
                      <NumberInput label={i === 0 ? 'Limit' : undefined} min={0} value={row.limit} allowNegative={false}
                        onChange={v => updateRow(i, { limit: Number(v) || 0 })} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <Select label={i === 0 ? 'Chế độ' : undefined} data={MODE_OPTS} value={row.default_mode} allowDeselect={false}
                        onChange={v => updateRow(i, { default_mode: v || 'fixed' })} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 2, sm: 1 }}>
                      <Tooltip label="Xóa dòng"><ActionIcon variant="subtle" color="red" size="input-md" aria-label="Xóa dòng"
                        onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}><Trash2 size={16} /></ActionIcon></Tooltip>
                    </Grid.Col>
                  </Grid>
                ))}
                <Button variant="light" leftSection={<Plus size={16} />} style={{ alignSelf: 'flex-start' }}
                  onClick={() => setRows(r => [...r, { key: '', label: '', limit: 1, default_mode: 'fixed' }])}>Thêm placement</Button>
              </Stack>
            ) : (
              <Textarea autosize minRows={8} maxRows={16} styles={MONO} value={form.placements}
                onChange={e => { const v = e.currentTarget.value; setForm(f => ({ ...f, placements: v })) }} />
            )}
          </Stack>

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button onClick={submit} loading={saving}>{editSite ? 'Cập nhật' : 'Tạo site'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Import JSON */}
      <Modal opened={bulkOpen} onClose={() => setBulkOpen(false)} size="lg" title="Import sites (JSON)">
        <Stack>
          <Text size="sm" c="dimmed">
            Dán mảng JSON. Mỗi object cần <Code>id</Code>, <Code>name</Code>, <Code>placements</Code>; tùy chọn <Code>domain</Code>, <Code>sort_order</Code>. Site đã tồn tại sẽ được bỏ qua.
          </Text>
          <Button variant="light" style={{ alignSelf: 'flex-start' }} onClick={() => setBulkJson(BULK_SAMPLE)}>Chèn ví dụ mẫu</Button>
          <Textarea label="Sites (JSON)" autosize minRows={10} maxRows={18} styles={MONO} value={bulkJson}
            onChange={e => setBulkJson(e.currentTarget.value)}
            placeholder='[{"id":"nganh-g","name":"Ngành G","placements":{"button":{"label":"Nút bấm","limit":2,"default_mode":"fixed"}}}]' />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBulkOpen(false)}>Hủy</Button>
            <Button onClick={handleBulkImport} loading={bulking}>Import</Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  )
}
