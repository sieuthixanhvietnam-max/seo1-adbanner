'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon, Alert, Badge, Button, Group, NumberInput, Paper, SegmentedControl,
  Skeleton, Stack, Table, Text, ThemeIcon, Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { AlertTriangle, Ban, CircleCheck, Globe, Link2, Trash2, Zap } from 'lucide-react'
import Page from '@/components/PageHeader'
import EntityCard from '@/components/ui/EntityCard'
import StatCard from '@/components/ui/StatCard'
import ViewToggle from '@/components/ui/ViewToggle'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { StatGrid, CardGrid } from '@/components/ui/Grids'
import { fmtDate } from '@/lib/format'
import { imageDomainApi } from '@/lib/api'
import type { ImageDomain } from '@/lib/types'
import { useViewMode } from '@/lib/useViewMode'

type Filter = 'all' | 'free' | 'used' | 'blocked'

const statusColor = (d: ImageDomain) => {
  if (d.is_blocked) return 'red'
  if (!d.is_active) return 'gray'
  if (d.assigned_to) return 'green'
  return 'yellow'
}
const statusLabel = (d: ImageDomain) => {
  if (d.is_blocked) return 'Blocked'
  if (!d.is_active) return 'Inactive'
  if (d.assigned_to) return 'Used'
  return 'Free'
}
const matchFilter = (d: ImageDomain, f: Filter) => {
  if (f === 'all') return true
  if (f === 'blocked') return d.is_blocked
  if (f === 'used') return !d.is_blocked && !!d.assigned_to
  return !d.is_blocked && d.is_active && !d.assigned_to
}

export default function ImageDomainsPage() {
  const [domains, setDomains] = useState<ImageDomain[] | null>(null)
  const [stats, setStats] = useState<any>({})
  const [generateCount, setGenerateCount] = useState<number | string>(10)
  const [generating, setGenerating] = useState(false)
  const [view, setView] = useViewMode('image-domains', 'table')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = () => imageDomainApi.getAll().then(r => {
    if (r.success) { setDomains(r.data || []); setStats(r.stats || {}) }
    else { setDomains(d => d ?? []); notifications.show({ color: 'red', message: r.message || 'Không tải được domains' }) }
  }).catch((e: any) => {
    setDomains(d => d ?? [])
    notifications.show({ color: 'red', message: e?.message || 'Không tải được domains' })
  })
  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const r = await imageDomainApi.generate(Number(generateCount) || 1)
      if (r.success) { notifications.show({ color: 'green', message: r.message || 'Đã tạo domains' }); load() }
      else notifications.show({ color: 'red', message: r.message || 'Tạo thất bại' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || 'Tạo thất bại' })
    } finally { setGenerating(false) }
  }

  const handleBlock = async (d: ImageDomain) => {
    const r = await imageDomainApi.update(d.id, { is_blocked: !d.is_blocked })
    if (!r.success) notifications.show({ color: 'red', message: r.message || 'Cập nhật thất bại' })
    load()
  }

  const handleDelete = (d: ImageDomain) => modals.openConfirmModal({
    title: 'Xóa domain này?',
    children: <Text size="sm">Domain <Text span ff="monospace" fw={600}>{d.base_url}</Text> sẽ bị xóa khỏi pool.</Text>,
    labels: { confirm: 'Xóa domain', cancel: 'Hủy' }, confirmProps: { color: 'red' },
    onConfirm: async () => {
      const r = await imageDomainApi.delete(d.id)
      if (r.success) notifications.show({ color: 'green', message: 'Đã xóa domain.' })
      else notifications.show({ color: 'red', message: r.message || 'Xóa thất bại' })
      load()
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (domains || []).filter(d =>
      matchFilter(d, filter) && (!q || [d.base_url, d.site_name, d.assigned_to].some(v => (v || '').toLowerCase().includes(q))))
  }, [domains, query, filter])

  const available = stats.available || 0
  const loading = domains === null

  const RowActions = ({ d }: { d: ImageDomain }) => (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Tooltip label={d.is_blocked ? 'Bỏ chặn domain' : 'Chặn domain'}>
        <ActionIcon variant="subtle" color={d.is_blocked ? 'green' : 'red'} onClick={() => handleBlock(d)}
          aria-label={d.is_blocked ? 'Bỏ chặn domain' : 'Chặn domain'}>
          {d.is_blocked ? <CircleCheck size={16} /> : <Ban size={16} />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Xóa domain">
        <ActionIcon variant="subtle" color="gray" onClick={() => handleDelete(d)} aria-label="Xóa domain"><Trash2 size={16} /></ActionIcon>
      </Tooltip>
    </Group>
  )

  const actions = (
    <>
      <NumberInput w={90} min={1} max={100} allowDecimal={false} aria-label="Số lượng domain" value={generateCount} onChange={setGenerateCount} />
      <Button leftSection={<Zap size={16} />} onClick={handleGenerate} loading={generating}>Generate</Button>
    </>
  )

  return (
    <Page title="Image Domains" description="Pool subdomain ảnh chống footprint SEO. Mỗi site được gán một domain riêng." actions={actions}>
      <StatGrid>
        <StatCard label="Tổng domain" value={stats.total || 0} icon={Globe} loading={loading} hint="Trong pool" />
        <StatCard label="Khả dụng" value={stats.available || 0} of={stats.total || 0} icon={CircleCheck} color={available < 10 ? 'yellow' : 'green'}
          loading={loading} hint={available < 10 ? 'Sắp hết, nên Generate' : 'Sẵn sàng gán'} />
        <StatCard label="Đang dùng" value={stats.used || 0} of={stats.total || 0} icon={Link2} loading={loading} hint="Đã gán cho site" />
        <StatCard label="Bị block" value={stats.blocked || 0} of={stats.total || 0} icon={Ban} color={stats.blocked ? 'red' : 'gray'}
          loading={loading} hint={stats.blocked ? 'Không dùng được' : 'Không có'} />
      </StatGrid>

      {!loading && available < 10 && (
        <Alert color="yellow" icon={<AlertTriangle size={18} />} title="Pool sắp hết!">
          Chỉ còn {available} domain khả dụng. Dùng Generate để tạo thêm.
        </Alert>
      )}

      <Group justify="space-between" wrap="wrap">
        <Group wrap="wrap">
          <SearchInput placeholder="Tìm theo domain, site"
            value={query} onChange={e => setQuery(e.currentTarget.value)} />
          <SegmentedControl value={filter} onChange={v => setFilter(v as Filter)}
            data={[
              { value: 'all', label: 'Tất cả' }, { value: 'free', label: 'Free' },
              { value: 'used', label: 'Used' }, { value: 'blocked', label: 'Blocked' },
            ]} />
        </Group>
        <ViewToggle value={view} onChange={setView} />
      </Group>

      {loading ? (
        <Stack>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={48} />)}</Stack>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Globe}
          title={domains.length === 0 ? 'Chưa có domain nào' : 'Không có domain khớp bộ lọc'}
          description={domains.length === 0 ? 'Dùng Generate để tạo domain cho pool.' : 'Thử đổi từ khóa hoặc trạng thái.'} />
      ) : view === 'table' ? (
        <Paper>
          <Table.ScrollContainer minWidth={680}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Domain</Table.Th><Table.Th w={110}>Status</Table.Th>
                  <Table.Th>Gán cho site</Table.Th><Table.Th w={120}>Tạo lúc</Table.Th><Table.Th w={96} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(d => (
                  <Table.Tr key={d.id}>
                    <Table.Td>
                      <Text ff="monospace" size="sm" c={d.is_blocked ? 'dimmed' : undefined} td={d.is_blocked ? 'line-through' : undefined}>{d.base_url}</Text>
                    </Table.Td>
                    <Table.Td><Badge variant="light" color={statusColor(d)}>{statusLabel(d)}</Badge></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{d.site_name || d.assigned_to || '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{fmtDate(d.created_at)}</Text></Table.Td>
                    <Table.Td><RowActions d={d} /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : (
        <CardGrid maxCols={3}>
          {filtered.map(d => (
            <EntityCard key={d.id} dimmed={d.is_blocked || !d.is_active}
              leading={<ThemeIcon size={36} radius="md" variant="light" color={statusColor(d)}><Globe size={18} strokeWidth={1.8} /></ThemeIcon>}
              title={<Text ff="monospace" size="sm" fw={600} truncate title={d.base_url}
                c={d.is_blocked ? 'dimmed' : undefined} td={d.is_blocked ? 'line-through' : undefined}>{d.base_url.replace(/^https?:\/\//, '')}</Text>}
              subtitle={<Text size="xs" c="dimmed">{fmtDate(d.created_at)}</Text>}
              status={<Badge variant="light" color={statusColor(d)} style={{ flexShrink: 0 }}>{statusLabel(d)}</Badge>}
              footer={<>
                <Text size="xs" c="dimmed" truncate>Gán: {d.site_name || d.assigned_to || 'Chưa gán'}</Text>
                <RowActions d={d} />
              </>} />
          ))}
        </CardGrid>
      )}
    </Page>
  )
}
