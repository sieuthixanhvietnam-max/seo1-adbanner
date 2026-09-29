'use client'
import { useState, useEffect, useRef } from 'react'
import {
  ActionIcon, Anchor, Badge, Button, Code, CopyButton, Group, Pagination, Paper, Skeleton,
  Stack, Table, Text, TextInput, ThemeIcon, Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { RefreshCw, Link2, Clock, Rows3, Database, Trash2, Copy, Check, ExternalLink, Save } from 'lucide-react'
import Page from '@/components/PageHeader'
import StatCard from '@/components/ui/StatCard'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { StatGrid } from '@/components/ui/Grids'
import { fmtDateTime } from '@/lib/format'
import { trackingApi } from '@/lib/api'

interface TrackingRow {
  domain: string
  brand_id: string
  track_url: string
  updated_at: string
}

interface SyncStatus {
  last_sync: string | null
  row_count: number
  sheet_url: string | null
  last_sync_rows: number
}

const LIMIT = 100
const MONO = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } }

const FORMAT_SAMPLE = [
  ['moto88.ru.com', 'net88', 'https://net88.com/go?aff=moto88_001'],
  ['moto88.ru.com', 'gem88', 'https://gem88.com/go?aff=moto88_x'],
  ['debet88.com.co', 'net88', 'https://net88.com/go?aff=debet_007'],
]

export default function TrackingPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [rows, setRows] = useState<TrackingRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [sheetUrl, setSheetUrl] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const filterRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const firstRun = useRef(true)

  const loadStatus = async () => {
    try {
      const r = await trackingApi.getStatus()
      if (r.success) {
        setStatus(r.data)
        if (r.data.sheet_url) setSheetUrl(r.data.sheet_url)
      } else notifications.show({ color: 'red', message: r.message || 'Không tải được trạng thái sync' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Không tải được trạng thái sync' })
    } finally { setStatusLoaded(true) }
  }

  const loadRows = async (p = page, domain = filterDomain, brand = filterBrand) => {
    const params: any = { page: p, limit: LIMIT }
    if (domain) params.domain = domain
    if (brand) params.brand_id = brand
    try {
      const r = await trackingApi.getAll(params)
      if (r.success) { setRows(r.data || []); setTotal(r.total || 0) }
      else { setRows(prev => prev || []); notifications.show({ color: 'red', message: r.message || 'Không tải được danh sách tracking' }) }
    } catch (e: any) {
      setRows(prev => prev || [])
      notifications.show({ color: 'red', message: e.message || 'Không tải được danh sách tracking' })
    }
  }

  useEffect(() => { loadStatus(); loadRows(1) }, [])

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    clearTimeout(filterRef.current)
    filterRef.current = setTimeout(() => { setPage(1); loadRows(1, filterDomain, filterBrand) }, 350)
    return () => clearTimeout(filterRef.current)
  }, [filterDomain, filterBrand])

  const handleSaveUrl = async () => {
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      return notifications.show({ color: 'red', message: 'URL phải là Google Sheet (docs.google.com/spreadsheets/...)' })
    }
    setSaving(true)
    try {
      const r = await trackingApi.saveSheetUrl(sheetUrl)
      notifications.show({ color: r.success ? 'green' : 'red', message: r.success ? 'Đã lưu Sheet URL' : (r.message || 'Lỗi lưu URL') })
      if (r.success) loadStatus()
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Lỗi lưu URL' })
    } finally { setSaving(false) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const r = await trackingApi.sync()
      notifications.show({ color: r.success ? 'green' : 'red', message: r.success ? (r.message || 'Sync thành công') : (r.message || 'Lỗi sync') })
      if (r.success) { loadStatus(); loadRows(1) }
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Lỗi sync' })
    } finally { setSyncing(false) }
  }

  const handleDelete = (domain: string, brand_id?: string) => {
    const label = brand_id ? `${brand_id} / ${domain}` : `toàn bộ ${domain}`
    modals.openConfirmModal({
      title: 'Xóa tracking link?',
      children: <Text size="sm">Xóa tracking {label}?</Text>,
      labels: { confirm: 'Xóa tracking link', cancel: 'Hủy' }, confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const r = await trackingApi.delete(domain, brand_id)
          if (r.success) { notifications.show({ color: 'green', message: 'Đã xóa' }); loadRows(page); loadStatus() }
          else notifications.show({ color: 'red', message: r.message || 'Xóa thất bại' })
        } catch (e: any) {
          notifications.show({ color: 'red', message: e.message || 'Xóa thất bại' })
        }
      },
    })
  }

  const changePage = (p: number) => { setPage(p); loadRows(p) }
  const totalPages = Math.ceil(total / LIMIT)
  const filtering = !!(filterDomain || filterBrand)

  const actions = (
    <Button leftSection={<RefreshCw size={16} />} loading={syncing} onClick={handleSync}>
      {syncing ? 'Đang sync...' : 'Sync từ Sheet'}
    </Button>
  )

  return (
    <Page title="Tracking Links" description="Link tracking của từng domain và nhà cái, đồng bộ từ Google Sheet." actions={actions}>
      <StatGrid>
        <StatCard label="Tổng tracking links" icon={Database} loading={!statusLoaded} value={status?.row_count ?? '—'}
          hint="Đang lưu trong hệ thống" />
        <StatCard label="Sync lần cuối" icon={Clock} color={status?.last_sync ? 'green' : 'yellow'} loading={!statusLoaded}
          value={<Text span fz={18} fw={700}>{fmtDateTime(status?.last_sync)}</Text>}
          hint={status?.last_sync ? 'Đồng bộ từ Google Sheet' : 'Chưa từng đồng bộ'} />
        <StatCard label="Rows lần sync cuối" icon={Rows3} color="gray" loading={!statusLoaded} value={status?.last_sync_rows || '—'}
          hint="Số dòng đọc được từ Sheet" />
      </StatGrid>

      <Paper p="md" shadow="xs">
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <ThemeIcon variant="light" size={40} radius="md"><Link2 size={20} strokeWidth={1.8} /></ThemeIcon>
              <Stack gap={0}>
                <Text fw={600}>Google Sheet CSV</Text>
                <Text size="sm" c="dimmed">
                  Google Sheet → <b>File → Share → Publish to web</b> → chọn sheet → <b>CSV</b> → Publish → copy link.
                </Text>
              </Stack>
            </Group>
            {status?.sheet_url && (
              <Anchor href={status.sheet_url} target="_blank" rel="noopener noreferrer" size="sm">
                <Group gap={4} wrap="nowrap">Xem Sheet <ExternalLink size={14} /></Group>
              </Anchor>
            )}
          </Group>

          <Group align="flex-end" wrap="wrap" gap="sm">
            <TextInput style={{ flex: '1 1 320px' }} styles={MONO} label="Sheet URL"
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              value={sheetUrl} onChange={e => setSheetUrl(e.currentTarget.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveUrl()} />
            <Button variant="default" leftSection={<Save size={16} />} loading={saving} onClick={handleSaveUrl}>
              {saving ? 'Đang lưu...' : 'Lưu URL'}
            </Button>
          </Group>

          <Paper withBorder p="sm" bg="var(--mantine-color-default-hover)">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="xs">Format sheet — 3 cột, row 1 là header</Text>
            <Table.ScrollContainer minWidth={520}>
              <Table withTableBorder withColumnBorders verticalSpacing={4} ff="monospace" fz="xs">
                <Table.Thead>
                  <Table.Tr><Table.Th>domain</Table.Th><Table.Th>brand_id</Table.Th><Table.Th>tracking_url</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {FORMAT_SAMPLE.map((row, i) => (
                    <Table.Tr key={i}>{row.map((cell, j) => <Table.Td key={j} c="dimmed">{cell}</Table.Td>)}</Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Text size="xs" c="dimmed" mt="xs">
              domain: không có www. / https:// · brand_id: khớp chính xác · tracking_url: URL đầy đủ từ nhà cái
            </Text>
          </Paper>
        </Stack>
      </Paper>

      <Group justify="space-between" wrap="wrap">
        <Group wrap="wrap">
          <SearchInput w={{ base: '100%', sm: 260 }} placeholder="Lọc theo domain"
            value={filterDomain} onChange={e => setFilterDomain(e.currentTarget.value)} />
          <SearchInput w={{ base: '100%', sm: 180 }} placeholder="Lọc brand_id"
            value={filterBrand} onChange={e => setFilterBrand(e.currentTarget.value)} />
        </Group>
        <Text size="sm" c="dimmed">{total.toLocaleString('vi-VN')} links</Text>
      </Group>

      {rows === null ? (
        <Stack>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={44} />)}</Stack>
      ) : rows.length === 0 ? (
        <EmptyState icon={Link2} title={filtering ? 'Không tìm thấy kết quả' : 'Chưa có tracking link'}
          description={filtering ? 'Thử đổi từ khóa lọc.' : 'Sync từ Google Sheet để bắt đầu.'} />
      ) : (
        <Paper>
          <Table.ScrollContainer minWidth={820}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={220}>Domain</Table.Th><Table.Th w={120}>Brand</Table.Th><Table.Th>Tracking URL</Table.Th>
                  <Table.Th w={160}>Cập nhật</Table.Th><Table.Th w={48} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map(r => (
                  <Table.Tr key={`${r.domain}:${r.brand_id}`}>
                    <Table.Td><Code>{r.domain}</Code></Table.Td>
                    <Table.Td><Badge variant="light" color="gray" tt="none">{r.brand_id}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" ff="monospace" c="dimmed" style={{ wordBreak: 'break-all', flex: 1 }}>{r.track_url}</Text>
                        <CopyButton value={r.track_url} timeout={1500}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Đã copy' : 'Copy URL'}>
                              <ActionIcon variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy} aria-label="Copy URL">
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{fmtDateTime(r.updated_at)}</Text></Table.Td>
                    <Table.Td>
                      <Tooltip label="Xóa tracking link">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(r.domain, r.brand_id)} aria-label="Xóa tracking link">
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {totalPages > 1 && (
            <Group justify="center" p="sm">
              <Pagination total={totalPages} value={page} onChange={changePage} />
            </Group>
          )}
        </Paper>
      )}
    </Page>
  )
}
