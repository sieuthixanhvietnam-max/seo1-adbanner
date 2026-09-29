'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spotlight, type SpotlightActionGroupData } from '@mantine/spotlight'
import { Globe, Search } from 'lucide-react'
import { siteApi } from '@/lib/api'
import type { Site } from '@/lib/types'
import { NAV_GROUPS } from './nav'

export default function AppSpotlight() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])

  useEffect(() => { siteApi.getAll().then(r => { if (r.success) setSites(r.data || []) }) }, [])

  const actions = useMemo<SpotlightActionGroupData[]>(() => [
    {
      group: 'Điều hướng',
      actions: NAV_GROUPS.flatMap(g => g.items).map(i => ({
        id: i.href,
        label: i.label,
        leftSection: <i.icon size={18} strokeWidth={1.8} />,
        onClick: () => router.push(i.href),
      })),
    },
    {
      group: 'Chuyển site (Slot Manager)',
      actions: sites.map(s => ({
        id: `site:${s.id}`,
        label: s.name,
        description: s.id,
        leftSection: <Globe size={18} strokeWidth={1.8} />,
        onClick: () => { localStorage.setItem('active_site', s.id); router.push('/admin/slots') },
      })),
    },
  ], [sites, router])

  return (
    <Spotlight
      actions={actions}
      shortcut="mod + K"
      highlightQuery
      nothingFound="Không tìm thấy kết quả"
      searchProps={{ leftSection: <Search size={18} />, placeholder: 'Tìm trang, chuyển site...' }}
    />
  )
}
