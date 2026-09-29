'use client'
import { useState, useEffect } from 'react'
import {
  ActionIcon, Alert, Badge, Button, Code, CopyButton, Group, Modal, Paper, Skeleton, Stack, Table, Text,
  Tabs, TextInput, Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { Plus, Copy, KeyRound, Check, Trash2, TriangleAlert, ShieldCheck, ShieldOff, BookOpen } from 'lucide-react'
import Page from '@/components/PageHeader'
import StatusSwitch from '@/components/ui/StatusSwitch'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import { StatGrid } from '@/components/ui/Grids'
import { fmtDateTime } from '@/lib/format'
import ApiDocs from '@/components/ApiDocs'
import { apiClientApi, imgUrl } from '@/lib/api'

interface ApiClient {
  id: string
  name: string
  key_prefix: string
  is_active: number
  last_used_at: string | null
  created_at: string
}

export default function ApiClientsPage() {
  const [clients, setClients] = useState<ApiClient[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null)

  const load = () => apiClientApi.getAll().then(r => {
    if (r.success) setClients(r.data || [])
    else { setClients(prev => prev || []); notifications.show({ color: 'red', message: r.message || 'Không tải được danh sách key' }) }
  }).catch((e: any) => {
    setClients(prev => prev || [])
    notifications.show({ color: 'red', message: e.message || 'Không tải được danh sách key' })
  })
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!name.trim()) return notifications.show({ color: 'red', message: 'Nhập tên dịch vụ' })
    setSaving(true)
    try {
      const r = await apiClientApi.create(name.trim())
      if (!r.success) return notifications.show({ color: 'red', message: r.message || 'Tạo thất bại' })
      setShowForm(false)
      setName('')
      setNewKey({ name: r.data.name, key: r.data.key })
      load()
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Tạo thất bại' })
    } finally { setSaving(false) }
  }

  const handleToggle = async (c: ApiClient) => {
    setClients(list => (list || []).map(x => x.id === c.id ? { ...x, is_active: x.is_active ? 0 : 1 } : x))
    try {
      const r = await apiClientApi.update(c.id, { is_active: !c.is_active })
      if (!r.success) notifications.show({ color: 'red', message: r.message || 'Cập nhật thất bại' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e.message || 'Cập nhật thất bại' })
    }
    load()
  }

  const handleDelete = (c: ApiClient) => modals.openConfirmModal({
    title: `Thu hồi key của "${c.name}"?`,
    children: <Text size="sm">Thu hồi vĩnh viễn key này. Dịch vụ đang dùng key sẽ bị 401 ngay.</Text>,
    labels: { confirm: 'Thu hồi key', cancel: 'Hủy' }, confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        const r = await apiClientApi.delete(c.id)
        if (r.success) notifications.show({ color: 'green', message: 'Đã thu hồi key.' })
        else notifications.show({ color: 'red', message: r.message || 'Xóa thất bại' })
      } catch (e: any) {
        notifications.show({ color: 'red', message: e.message || 'Xóa thất bại' })
      }
      load()
    },
  })

  const activeCount = (clients || []).filter(c => c.is_active).length
  const inactiveCount = (clients || []).length - activeCount
  // Đọc sau khi mount để HTML server và client khớp nhau (tránh lỗi hydration)
  const [base, setBase] = useState('')
  useEffect(() => { setBase(imgUrl('/').replace(/\/$/, '')) }, [])

  return (
    <Page title="API Clients" description="Quản lý API key cho các dịch vụ nội bộ truy cập dữ liệu chỉ đọc."
      actions={<Button leftSection={<Plus size={16} />} onClick={() => setShowForm(true)}>Tạo key</Button>}>

      <Tabs defaultValue="keys" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="keys" leftSection={<KeyRound size={16} />}>Danh sách key</Tabs.Tab>
          <Tabs.Tab value="docs" leftSection={<BookOpen size={16} />}>Hướng dẫn &amp; tài liệu</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="keys" pt="md">
          <Stack gap="md">
      <StatGrid>
        <StatCard label="Tổng API key" icon={KeyRound} loading={clients === null} value={clients?.length ?? 0}
          hint="Dịch vụ được cấp quyền" />
        <StatCard label="Đang hoạt động" icon={ShieldCheck} color="green" loading={clients === null}
          value={activeCount} of={clients?.length ?? 0} hint="Có thể gọi API" />
        <StatCard label="Đã tắt" icon={ShieldOff} color={inactiveCount > 0 ? 'yellow' : 'gray'} loading={clients === null}
          value={inactiveCount} of={clients?.length ?? 0} hint={inactiveCount > 0 ? 'Bị từ chối với 401' : 'Không có key bị tắt'} />
      </StatGrid>


      {clients === null ? (
        <Stack>{[0, 1, 2].map(i => <Skeleton key={i} h={52} />)}</Stack>
      ) : clients.length === 0 ? (
        <EmptyState icon={KeyRound} title="Chưa có API key nào" description="Tạo key đầu tiên để cấp quyền cho một dịch vụ."
          action={<Button mt="sm" leftSection={<Plus size={16} />} onClick={() => setShowForm(true)}>Tạo key</Button>} />
      ) : (
        <Paper>
          <Table.ScrollContainer minWidth={760}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Dịch vụ</Table.Th><Table.Th>Key</Table.Th><Table.Th w={170}>Trạng thái</Table.Th>
                  <Table.Th>Dùng lần cuối</Table.Th><Table.Th>Tạo lúc</Table.Th><Table.Th w={56} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {clients.map(c => (
                  <Table.Tr key={c.id}>
                    <Table.Td><Text fw={600}>{c.name}</Text></Table.Td>
                    <Table.Td><Code>{c.key_prefix}…</Code></Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <StatusSwitch checked={!!c.is_active} onChange={() => handleToggle(c)} aria-label={`Bật/tắt ${c.name}`} />
                        <Badge variant="light" color={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'Hoạt động' : 'Đã tắt'}</Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{fmtDateTime(c.last_used_at)}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{fmtDateTime(c.created_at)}</Text></Table.Td>
                    <Table.Td>
                      <Tooltip label="Thu hồi">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(c)} aria-label="Thu hồi">
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="docs" pt="md"><ApiDocs base={base} /></Tabs.Panel>
      </Tabs>

      <Modal opened={showForm} onClose={() => setShowForm(false)} title="Tạo API key">
        <Stack>
          <TextInput label="Tên dịch vụ" data-autofocus maxLength={80} placeholder="vd: redirect-monitor"
            value={name} onChange={e => setName(e.currentTarget.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button onClick={handleCreate} loading={saving}>{saving ? 'Đang tạo...' : 'Tạo'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hiển thị key một lần: không đóng bằng click ngoài / Esc */}
      <Modal opened={!!newKey} onClose={() => setNewKey(null)} size="lg" title={`Key của "${newKey?.name ?? ''}"`}
        closeOnClickOutside={false} closeOnEscape={false} withCloseButton={false}>
        <Stack>
          <Alert color="yellow" icon={<TriangleAlert size={18} />}>
            Chỉ hiển thị một lần duy nhất. Hãy lưu lại ngay, đóng cửa sổ này sẽ không xem lại được.
          </Alert>
          <Group align="flex-end" wrap="nowrap" gap="sm">
            <TextInput style={{ flex: 1 }} readOnly value={newKey?.key ?? ''} onFocus={e => e.currentTarget.select()}
              styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }} />
            <CopyButton value={newKey?.key ?? ''} timeout={2000}>
              {({ copied, copy }) => (
                <Button variant="default" color={copied ? 'green' : undefined}
                  leftSection={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copy}>
                  {copied ? 'Đã copy' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end">
            <Button onClick={() => setNewKey(null)}>Đã lưu, đóng</Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  )
}
