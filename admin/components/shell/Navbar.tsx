'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ActionIcon, AppShell, Divider, NavLink, ScrollArea, Stack, Text, Tooltip } from '@mantine/core'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NAV_GROUPS } from './nav'

export default function Navbar({ collapsed, onToggleCollapse, onNavigate }: {
  collapsed: boolean
  onToggleCollapse: () => void
  onNavigate: () => void
}) {
  const pathname = usePathname()

  return (
    <>
      <AppShell.Section grow component={ScrollArea} p="sm">
        <Stack gap="md">
          {NAV_GROUPS.map(group => (
            <Stack key={group.label} gap={2}>
              {!collapsed && <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" mb={4}>{group.label}</Text>}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href)
                const link = (
                  <NavLink
                    key={href} component={Link} href={href} active={active} onClick={onNavigate}
                    label={collapsed ? undefined : label}
                    leftSection={<Icon size={18} strokeWidth={active ? 2 : 1.7} />}
                    variant="light" style={{ borderRadius: 'var(--mantine-radius-default)' }}
                    styles={collapsed ? { root: { justifyContent: 'center' }, section: { marginInlineEnd: 0 } } : undefined}
                    aria-label={label}
                  />
                )
                return collapsed ? <Tooltip key={href} label={label} position="right">{link}</Tooltip> : link
              })}
            </Stack>
          ))}
        </Stack>
      </AppShell.Section>

      <AppShell.Section visibleFrom="sm">
        <Divider />
        <Stack p="sm" align={collapsed ? 'center' : 'flex-start'}>
          <Tooltip label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} position="right">
            <ActionIcon variant="subtle" color="gray" onClick={onToggleCollapse} aria-label="Thu gọn menu">
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </ActionIcon>
          </Tooltip>
        </Stack>
      </AppShell.Section>
    </>
  )
}
