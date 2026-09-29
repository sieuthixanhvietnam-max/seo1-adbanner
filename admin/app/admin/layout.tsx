'use client'
import { AppShell } from '@mantine/core'
import { useDisclosure, useLocalStorage } from '@mantine/hooks'
import Topbar from '@/components/shell/Topbar'
import Navbar from '@/components/shell/Navbar'
import AppSpotlight from '@/components/shell/AppSpotlight'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false)
  const [collapsed, setCollapsed] = useLocalStorage({
    key: 'sidebar_collapsed', defaultValue: false, getInitialValueInEffect: true,
    serialize: v => (v ? '1' : '0'), deserialize: v => v === '1',
  })

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: collapsed ? 68 : 240, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding={0}
      transitionDuration={200}
    >
      <AppShell.Header><Topbar opened={mobileOpened} onToggle={toggleMobile} /></AppShell.Header>
      <AppShell.Navbar>
        <Navbar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} onNavigate={closeMobile} />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
      <AppSpotlight />
    </AppShell>
  )
}
