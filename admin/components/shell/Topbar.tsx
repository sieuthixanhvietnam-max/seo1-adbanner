'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ActionIcon, Avatar, Box, Burger, Divider, Group, Kbd, Menu, Switch, Text, ThemeIcon, Tooltip, UnstyledButton,
  useComputedColorScheme, useMantineColorScheme,
} from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import { ChevronDown, ChevronRight, ImageIcon, KeyRound, LogOut, Moon, Search, Settings, Sun } from 'lucide-react'
import { authApi, getBaseUrl } from '@/lib/api'
import ConnectionSettings from './ConnectionSettings'
import ChangePasswordModal from './ChangePasswordModal'
import StatusPill, { type Health } from './StatusPill'
import { NAV_GROUPS } from './nav'

export default function Topbar({ opened, onToggle }: { opened: boolean; onToggle: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setColorScheme } = useMantineColorScheme()
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const [health, setHealth] = useState<Health>(null)
  const [apiHost, setApiHost] = useState('')
  const [settings, setSettings] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pwForced, setPwForced] = useState(false)

  const [checking, setChecking] = useState(false)

  const ping = useCallback(async () => {
    const base = getBaseUrl()
    setChecking(true)
    const t0 = performance.now()
    try {
      const r = await fetch(`${base}/health`, { cache: 'no-store' })
      setHealth({ ok: r.ok, ms: Math.round(performance.now() - t0), at: Date.now() })
    } catch { setHealth({ ok: false, ms: 0, at: Date.now() }) }
    setChecking(false)
  }, [])

  useEffect(() => {
    const base = getBaseUrl()
    try { setApiHost(new URL(base).host) } catch { setApiHost(base) }
    ping()
    const t = setInterval(ping, 30000)
    return () => clearInterval(t)
  }, [ping])

  // Mật khẩu chưa đạt chính sách (vd mật khẩu khởi tạo) → bắt buộc đổi ngay
  useEffect(() => {
    authApi.session().then(r => { if (r.success && r.must_change_password) { setPwForced(true); setPwOpen(true) } })
  }, [])

  // Đường dẫn hiện tại: Nhóm › Trang
  const crumb = useMemo(() => {
    for (const g of NAV_GROUPS) {
      const item = g.items.find(i => pathname.startsWith(i.href))
      if (item) return { group: g.label, page: item.label }
    }
    return null
  }, [pathname])

  const isLocal = apiHost.startsWith('localhost') || apiHost.startsWith('127.0.0.1')

  const logout = () => {
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
    router.push('/login')
  }

  return (
    <>
      <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="md">
        {/* Trái: thương hiệu + đường dẫn */}
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <Burger opened={opened} onClick={onToggle} hiddenFrom="sm" size="sm" aria-label="Mở menu" />
          <UnstyledButton component={Link} href="/admin/sites" aria-label="Trang chủ">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={34} radius="md"><ImageIcon size={18} strokeWidth={2} /></ThemeIcon>
              <Box visibleFrom="xs" lh={1.2}>
                <Text fw={700} size="sm" style={{ letterSpacing: '-0.01em' }}>Banner SEO1</Text>
                <Text size="xs" c="dimmed">Bảng điều khiển quản trị</Text>
              </Box>
            </Group>
          </UnstyledButton>

          {crumb && (
            <>
              <Divider orientation="vertical" my={16} visibleFrom="md" />
              <Group gap={6} wrap="nowrap" visibleFrom="md" aria-label="Đường dẫn">
                <Text size="sm" c="dimmed">{crumb.group}</Text>
                <ChevronRight size={14} color="var(--mantine-color-dimmed)" />
                <Text size="sm" fw={600}>{crumb.page}</Text>
              </Group>
            </>
          )}
        </Group>

        {/* Phải: tìm nhanh, trạng thái, giao diện, tài khoản */}
        <Group gap="sm" wrap="nowrap">
          <UnstyledButton onClick={() => spotlight.open()} visibleFrom="sm" aria-label="Tìm nhanh"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, height: 32, padding: '0 10px', width: 260,
              borderRadius: 'var(--mantine-radius-default)', border: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-default-hover)', color: 'var(--mantine-color-dimmed)',
            }}>
            <Search size={16} />
            <Text size="sm" c="dimmed" style={{ flex: 1 }}>Tìm trang, chuyển site…</Text>
            <Kbd size="xs">⌘ K</Kbd>
          </UnstyledButton>
          <ActionIcon variant="default" hiddenFrom="sm" onClick={() => spotlight.open()} aria-label="Tìm nhanh">
            <Search size={18} />
          </ActionIcon>

          <StatusPill health={health} apiHost={apiHost} isLocal={isLocal} checking={checking} onRefresh={ping} />

          <Tooltip label={scheme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
            <Switch
              size="sm"
              checked={scheme === 'dark'}
              onChange={e => setColorScheme(e.currentTarget.checked ? 'dark' : 'light')}
              aria-label="Chế độ tối"
              color="dark.4"
              thumbIcon={scheme === 'dark'
                ? <Moon size={12} strokeWidth={2.4} color="var(--mantine-color-yellow-4)" />
                : <Sun size={12} strokeWidth={2.4} color="var(--mantine-color-orange-6)" />}
              styles={{ track: { cursor: 'pointer' } }}
            />
          </Tooltip>

          <Divider orientation="vertical" my={16} visibleFrom="xs" />

          <Menu position="bottom-end" width={240} shadow="md">
            <Menu.Target>
              <UnstyledButton aria-label="Tài khoản">
                <Group gap="xs" wrap="nowrap">
                  <Avatar color="brand" variant="filled" size={30}>AD</Avatar>
                  <Box visibleFrom="md" lh={1.2}>
                    <Text size="sm" fw={600}>Admin</Text>
                    <Text size="xs" c="dimmed">Quản trị viên</Text>
                  </Box>
                  <ChevronDown size={14} color="var(--mantine-color-dimmed)" />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px="sm" py={8}>
                <Text size="sm" fw={600}>Quản trị viên</Text>
                <Text size="xs" c="dimmed" truncate>{apiHost || 'Chưa cấu hình API'}</Text>
              </Box>
              <Menu.Divider />
              <Menu.Item leftSection={<KeyRound size={16} />} onClick={() => { setPwForced(false); setPwOpen(true) }}>Đổi mật khẩu</Menu.Item>
              <Menu.Item leftSection={<Settings size={16} />} onClick={() => setSettings(true)}>Kết nối API</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<LogOut size={16} />} onClick={logout}>Đăng xuất</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      <ConnectionSettings opened={settings} onClose={() => setSettings(false)} />
      <ChangePasswordModal opened={pwOpen} forced={pwForced} onClose={() => setPwOpen(false)} onDone={() => { setPwOpen(false); setPwForced(false) }} />
    </>
  )
}
