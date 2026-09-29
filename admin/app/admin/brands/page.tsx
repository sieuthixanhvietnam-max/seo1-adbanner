'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Badge, Box, Button, Code, FileInput, Group, Modal, Paper, SegmentedControl,
  Skeleton, Stack, Table, Text, TextInput, Textarea, Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  ArrowRight, CircleCheck, History, Link2Off, Pencil, Plus, RefreshCw, Tag, Trash2, Upload, X,
} from 'lucide-react'
import Page from '@/components/PageHeader'
import ImageFrame from '@/components/ui/ImageFrame'
import EntityCard from '@/components/ui/EntityCard'
import StatCard from '@/components/ui/StatCard'
import ViewToggle from '@/components/ui/ViewToggle'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { StatGrid, CardGrid } from '@/components/ui/Grids'
import { fmtDateTime } from '@/lib/format'
import { brandApi, imgUrl } from '@/lib/api'
import type { Brand, BrandDomainHistory } from '@/lib/types'
import { useViewMode } from '@/lib/useViewMode'

const MONO = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } }

const BULK_SAMPLE = JSON.stringify([
  { id: 'net88', name: 'Net88', domain: 'https://net88vip.com/dang-nhap' },
  { id: '789bet', name: '789Bet', domain: 'https://789.com/dang-nhap' },
], null, 2)

type CheckResult = { checked: number; updated: { id: string; name: string; old_domain: string; new_domain: string }[] }

function BrandLogo({ b, size = 36 }: { b: Brand; size?: number }) {
  return <ImageFrame src={b.logo_url ? imgUrl(b.logo_url) : null} alt={b.name} w={size} h={size}
    style={{ borderRadius: 'var(--mantine-radius-sm)', border: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }} />
}

function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant="light" color={active ? 'green' : 'gray'}>{active ? 'Bật' : 'Tắt'}</Badge>
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null)
  const [view, setView] = useViewMode('brands', 'table')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'on' | 'off'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editBrand, setEditBrand] = useState<Brand | null>(null)
  const [form, setForm] = useState({ id: '', name: '', domain: '' })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [buttonFile, setButtonFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const [historyBrand, setHistoryBrand] = useState<Brand | null>(null)
  const [history, setHistory] = useState<BrandDomainHistory[] | null>(null)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulking, setBulking] = useState(false)

  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  const load = async () => {
    try {
      const res = await brandApi.getAll()
      if (res.success) setBrands(res.data || [])
      else { setBrands(b => b ?? []); notifications.show({ color: 'red', message: res.message || 'Không thể kết nối API!' }) }
    } catch {
      setBrands(b => b ?? [])
      notifications.show({ color: 'red', message: 'Không thể kết nối API!' })
    }
  }
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const all = brands || []
    return {
      total: all.length,
      on: all.filter(b => b.is_active).length,
      noDomain: all.filter(b => !b.login_url).length,
    }
  }, [brands])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (brands || []).filter(b => {
      if (status === 'on' && !b.is_active) return false
      if (status === 'off' && b.is_active) return false
      return !q || [b.name, b.id, b.login_url].some(v => (v || '').toLowerCase().includes(q))
    })
  }, [brands, query, status])

  const openCreate = () => {
    setEditBrand(null); setForm({ id: '', name: '', domain: '' })
    setLogoFile(null); setButtonFile(null); setFormOpen(true)
  }
  const openEdit = (b: Brand) => {
    setEditBrand(b); setForm({ id: b.id, name: b.name, domain: b.domain || '' })
    setLogoFile(null); setButtonFile(null); setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.id || !form.name) return notifications.show({ color: 'red', message: 'ID và tên là bắt buộc!' })
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
      notifications.show({ color: 'green', message: editBrand ? 'Đã cập nhật!' : 'Đã thêm brand!' })
      setFormOpen(false); load()
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Lỗi!' })
    } finally { setSaving(false) }
  }

  const doDelete = async (b: Brand) => {
    try {
      const res = await brandApi.delete(b.id)
      if (res.success) { notifications.show({ color: 'green', message: 'Đã xóa!' }); load(); return }
      if ((res as any).slot_count) {
        modals.openConfirmModal({
          title: 'Xóa tất cả?',
          children: <Text size="sm">{res.message}</Text>,
          labels: { confirm: 'Xóa brand', cancel: 'Hủy' }, confirmProps: { color: 'red' },
          onConfirm: async () => {
            const r2 = await brandApi.delete(b.id, true)
            if (r2.success) { notifications.show({ color: 'green', message: 'Đã xóa!' }); load() }
            else notifications.show({ color: 'red', message: r2.message || 'Lỗi!' })
          },
        })
      } else notifications.show({ color: 'red', message: res.message || 'Lỗi!' })
    } catch {
      notifications.show({ color: 'red', message: 'Lỗi kết nối' })
    }
  }

  const remove = (b: Brand) => modals.openConfirmModal({
    title: `Xóa brand "${b.name}"?`,
    children: <Text size="sm">Hành động không thể hoàn tác.</Text>,
    labels: { confirm: 'Xóa brand', cancel: 'Hủy' }, confirmProps: { color: 'red' },
    onConfirm: () => doDelete(b),
  })

  const openHistory = async (b: Brand) => {
    setHistoryBrand(b); setHistory(null)
    try {
      const res = await brandApi.getHistory(b.id)
      if (res.success) setHistory(res.data || [])
      else { setHistory([]); notifications.show({ color: 'red', message: res.message || 'Không tải được lịch sử domain' }) }
    } catch {
      setHistory([]); notifications.show({ color: 'red', message: 'Không tải được lịch sử domain' })
    }
  }

  const rollback = (b: Brand, h: BrandDomainHistory) => modals.openConfirmModal({
    title: 'Rollback về domain này?',
    children: <Text size="sm">Domain hiện tại sẽ được đổi về <Code>{h.old_domain}</Code>.</Text>,
    labels: { confirm: 'Rollback', cancel: 'Hủy' },
    onConfirm: async () => {
      const res = await brandApi.rollback(b.id, h.id)
      if (res.success) { notifications.show({ color: 'green', message: 'Đã rollback!' }); setHistoryBrand(null); load() }
      else notifications.show({ color: 'red', message: res.message || 'Lỗi!' })
    },
  })

  const handleBulkImport = async () => {
    let arr: any[]
    try { arr = JSON.parse(bulkJson); if (!Array.isArray(arr)) throw new Error('Phải là mảng JSON') }
    catch (e: any) { return notifications.show({ color: 'red', message: 'JSON không hợp lệ: ' + e.message }) }
    setBulking(true)
    try {
      const res = await brandApi.bulkImport(arr)
      if (res.success) {
        notifications.show({ color: 'green', message: res.message || 'Đã import!' })
        setBulkOpen(false); setBulkJson(''); load()
      } else notifications.show({ color: 'red', message: res.message || 'Lỗi import!' })
    } catch {
      notifications.show({ color: 'red', message: 'Lỗi import!' })
    } finally { setBulking(false) }
  }

  const handleCheckDomains = async () => {
    setChecking(true); setCheckResult(null)
    try {
      const res = await brandApi.checkDomains()
      if (res.success) {
        setCheckResult(res.data)
        notifications.show({ color: 'green', message: res.message || 'Hoàn tất check 301' })
        if (res.data?.updated?.length) load()
      } else notifications.show({ color: 'red', message: res.message || 'Lỗi check domains' })
    } catch {
      notifications.show({ color: 'red', message: 'Lỗi kết nối' })
    } finally { setChecking(false) }
  }

  const rowActions = (b: Brand) => (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      <Tooltip label="Sửa brand"><ActionIcon variant="subtle" color="gray" onClick={() => openEdit(b)} aria-label="Sửa brand"><Pencil size={16} /></ActionIcon></Tooltip>
      <Tooltip label="Lịch sử domain"><ActionIcon variant="subtle" color="gray" onClick={() => openHistory(b)} aria-label="Lịch sử domain"><History size={16} /></ActionIcon></Tooltip>
      <Tooltip label="Xóa brand"><ActionIcon variant="subtle" color="red" onClick={() => remove(b)} aria-label="Xóa brand"><Trash2 size={16} /></ActionIcon></Tooltip>
    </Group>
  )

  const actions = (
    <>
      <Button variant="default" leftSection={<RefreshCw size={16} />} loading={checking} onClick={handleCheckDomains}>
        {checking ? 'Đang check...' : 'Check 301'}
      </Button>
      <Button variant="default" leftSection={<Upload size={16} />} onClick={() => setBulkOpen(true)}>Import JSON</Button>
      <Button leftSection={<Plus size={16} />} onClick={openCreate}>Thêm brand</Button>
    </>
  )

  return (
    <Page title="Brands" description="Danh sách nhà cái dùng chung cho mọi site: domain đăng nhập, logo và ảnh nút bấm." actions={actions}>
      <StatGrid>
        <StatCard label="Tổng số brand" value={stats.total} icon={Tag} loading={brands === null} hint="Dùng chung cho mọi site" />
        <StatCard label="Đang bật" value={stats.on} of={stats.total} icon={CircleCheck} color="green" loading={brands === null}
          hint={`${stats.total - stats.on} brand đã tắt`} />
        <StatCard label="Chưa có domain" value={stats.noDomain} of={stats.total} icon={Link2Off} color={stats.noDomain ? 'yellow' : 'gray'}
          loading={brands === null} hint={stats.noDomain ? 'Cần bổ sung login URL' : 'Đã đủ domain'} />
      </StatGrid>

      {checkResult && (
        <Paper p="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Text size="sm" fw={600}>
              Check 301: {checkResult.checked} brand — {checkResult.updated.length ? `${checkResult.updated.length} cập nhật` : 'không có thay đổi'}
            </Text>
            <Tooltip label="Đóng"><ActionIcon variant="subtle" color="gray" onClick={() => setCheckResult(null)} aria-label="Đóng"><X size={16} /></ActionIcon></Tooltip>
          </Group>
          {checkResult.updated.length > 0 && (
            <Stack gap={6} mt="sm">
              {checkResult.updated.map(u => (
                <Group key={u.id} gap="xs" wrap="wrap">
                  <Text size="sm" fw={600}>{u.name}</Text>
                  <Code td="line-through" c="dimmed">{u.old_domain}</Code>
                  <ArrowRight size={14} color="var(--mantine-color-dimmed)" />
                  <Code c="brand">{u.new_domain}</Code>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Group justify="space-between" wrap="wrap">
        <Group wrap="wrap">
          <SearchInput placeholder="Tìm theo tên, ID, domain"
            value={query} onChange={e => setQuery(e.currentTarget.value)} />
          <SegmentedControl value={status} onChange={v => setStatus(v as any)}
            data={[{ value: 'all', label: 'Tất cả' }, { value: 'on', label: 'Đang bật' }, { value: 'off', label: 'Đã tắt' }]} />
        </Group>
        <ViewToggle value={view} onChange={setView} />
      </Group>

      {brands === null ? (
        <Stack>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={52} />)}</Stack>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Tag}
          title={brands.length === 0 ? 'Chưa có brand nào' : 'Không có brand khớp bộ lọc'}
          description={brands.length === 0 ? 'Thêm brand đầu tiên hoặc import hàng loạt bằng JSON.' : 'Thử đổi từ khóa hoặc trạng thái.'}
          action={brands.length === 0 ? <Button mt="sm" leftSection={<Plus size={16} />} onClick={openCreate}>Thêm brand</Button> : undefined} />
      ) : view === 'table' ? (
        <Paper>
          <Table.ScrollContainer minWidth={820}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Brand</Table.Th><Table.Th>Login URL</Table.Th><Table.Th>Ảnh nút bấm</Table.Th>
                  <Table.Th w={110}>Trạng thái</Table.Th><Table.Th w={124} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(b => (
                  <Table.Tr key={b.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <BrandLogo b={b} />
                        <Box style={{ minWidth: 0 }}>
                          <Text fw={600} truncate>{b.name}</Text>
                          <Text size="xs" c="dimmed" ff="monospace">{b.id}</Text>
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td>{b.login_url ? <Code>{b.login_url}</Code> : <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td>
                      {b.button_image
                        ? <ImageFrame src={imgUrl(b.button_image)} alt={`${b.name} button`} w={96} h={32} style={{ borderRadius: 'var(--mantine-radius-sm)', border: '1px solid var(--mantine-color-default-border)' }} />
                        : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td><StatusBadge active={!!b.is_active} /></Table.Td>
                    <Table.Td>{rowActions(b)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : (
        <CardGrid>
          {filtered.map(b => (
            <EntityCard key={b.id} dimmed={!b.is_active}
              leading={<BrandLogo b={b} size={44} />}
              title={b.name} subtitle={b.id}
              status={<StatusBadge active={!!b.is_active} />}
              footer={<>
                <Text size="xs" c="dimmed">{b.button_image ? 'Có ảnh nút bấm' : 'Chưa có ảnh nút'}</Text>
                {rowActions(b)}
              </>}>
              <Stack gap={4}>
                <Text size="xs" c="dimmed">Login URL</Text>
                {b.login_url ? <Code style={{ wordBreak: 'break-all' }}>{b.login_url}</Code> : <Text size="sm" c="dimmed">Chưa có domain</Text>}
              </Stack>
              {b.button_image && (
                <ImageFrame src={imgUrl(b.button_image)} alt={`${b.name} button`} h={44} style={{ borderRadius: 'var(--mantine-radius-sm)', border: '1px solid var(--mantine-color-default-border)' }} />
              )}
            </EntityCard>
          ))}
        </CardGrid>
      )}

      {/* Thêm / sửa brand */}
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editBrand ? `Sửa: ${editBrand.name}` : 'Thêm brand'}>
        <Stack>
          <TextInput label="ID (slug)" required value={form.id} placeholder="net88, 789, sun..." styles={MONO}
            onChange={e => setForm(f => ({ ...f, id: e.currentTarget.value }))} />
          <TextInput label="Tên brand" required value={form.name} placeholder="Net88"
            onChange={e => setForm(f => ({ ...f, name: e.currentTarget.value }))} />
          <TextInput label="Domain" description="Đổi khi bị block" value={form.domain} placeholder="https://net88vip.com/dang-nhap" styles={MONO}
            onChange={e => setForm(f => ({ ...f, domain: e.currentTarget.value }))} />
          <Group grow align="flex-start">
            <Stack gap={6}>
              <FileInput label="Logo (tùy chọn)" accept="image/*" clearable value={logoFile} onChange={setLogoFile} placeholder="Chọn ảnh" />
              {editBrand?.logo_url && !logoFile && (
                <ImageFrame src={imgUrl(editBrand.logo_url)} alt="logo hiện tại" h={56} style={{ borderRadius: 'var(--mantine-radius-sm)', border: '1px solid var(--mantine-color-default-border)' }} />
              )}
            </Stack>
            <Stack gap={6}>
              <FileInput label="Ảnh nút bấm (tùy chọn)" description="Cho Brand G" accept="image/*" clearable value={buttonFile} onChange={setButtonFile} placeholder="Chọn ảnh" />
              {editBrand?.button_image && !buttonFile && (
                <ImageFrame src={imgUrl(editBrand.button_image)} alt="nút hiện tại" h={56} style={{ borderRadius: 'var(--mantine-radius-sm)', border: '1px solid var(--mantine-color-default-border)' }} />
              )}
            </Stack>
          </Group>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button onClick={handleSubmit} loading={saving}>{editBrand ? 'Cập nhật' : 'Tạo brand'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Lịch sử domain */}
      <Modal opened={!!historyBrand} onClose={() => setHistoryBrand(null)} size="lg"
        title={historyBrand ? `Lịch sử đổi domain: ${historyBrand.name}` : ''}>
        {history === null ? (
          <Stack>{[0, 1, 2].map(i => <Skeleton key={i} h={36} />)}</Stack>
        ) : history.length === 0 ? (
          <EmptyState bare icon={History} title="Chưa có lịch sử" description="Các lần đổi domain sẽ xuất hiện tại đây." />
        ) : (
          <Table.ScrollContainer minWidth={480}>
            <Table>
              <Table.Thead>
                <Table.Tr><Table.Th>Thay đổi</Table.Th><Table.Th>Thời gian</Table.Th><Table.Th w={100} /></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {history.map(h => (
                  <Table.Tr key={h.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="wrap">
                        <Code>{h.old_domain}</Code>
                        <ArrowRight size={14} color="var(--mantine-color-dimmed)" />
                        <Code>{h.new_domain}</Code>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{fmtDateTime(h.changed_at)}</Text></Table.Td>
                    <Table.Td>
                      <Button size="compact-sm" variant="default" onClick={() => historyBrand && rollback(historyBrand, h)}>Rollback</Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Modal>

      {/* Import JSON */}
      <Modal opened={bulkOpen} onClose={() => setBulkOpen(false)} size="lg" title="Import brands hàng loạt (JSON)">
        <Stack>
          <Text size="sm" c="dimmed">
            Dán mảng JSON. Mỗi object cần <Code>id</Code>, <Code>name</Code>; tùy chọn <Code>domain</Code>.
          </Text>
          <Button variant="light" style={{ alignSelf: 'flex-start' }} onClick={() => setBulkJson(BULK_SAMPLE)}>Chèn ví dụ mẫu</Button>
          <Textarea label="Brands (JSON)" autosize minRows={10} maxRows={18} styles={MONO} value={bulkJson}
            onChange={e => setBulkJson(e.currentTarget.value)}
            placeholder='[{"id":"net88","name":"Net88","domain":"https://net88vip.com/dang-nhap"}]' />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBulkOpen(false)}>Hủy</Button>
            <Button onClick={handleBulkImport} loading={bulking}>Import</Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  )
}
