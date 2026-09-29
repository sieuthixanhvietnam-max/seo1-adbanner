'use client'
import { useEffect, useState } from 'react'
import { Select } from '@mantine/core'
import { Globe } from 'lucide-react'
import { siteApi } from '@/lib/api'
import type { Site } from '@/lib/types'

export default function SiteSwitcher({ value, onChange, autoSelect = false }: {
  value: string
  onChange: (id: string) => void
  /** Tự chọn site đầu tiên khi chưa có giá trị */
  autoSelect?: boolean
}) {
  const [sites, setSites] = useState<Site[]>([])

  useEffect(() => {
    siteApi.getAll().then(r => {
      if (!r.success) return
      const list: Site[] = r.data || []
      setSites(list)
      if (autoSelect && !value && list.length) onChange(list[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Select
      w={{ base: '100%', xs: 240 }}
      aria-label="Chọn site"
      placeholder="Chọn site"
      searchable
      allowDeselect={false}
      leftSection={<Globe size={16} />}
      nothingFoundMessage="Không tìm thấy site"
      data={sites.map(s => ({ value: s.id, label: s.is_active ? s.name : `${s.name} (tắt)` }))}
      value={value || null}
      onChange={v => v && onChange(v)}
    />
  )
}
