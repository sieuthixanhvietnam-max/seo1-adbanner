'use client'
import { useState, useEffect } from 'react'
import { Globe, Plus } from 'lucide-react'
import { siteApi } from '@/lib/api'
import type { Site } from '@/lib/types'
import { Select, type SelectOption } from '@/components/ui/Select'

export default function SiteSwitcher({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [sites, setSites] = useState<Site[]>([])
  useEffect(() => { siteApi.getAll().then(r => { if (r.success) setSites(r.data || []) }) }, [])

  const options: SelectOption[] = sites.map(s => ({
    value: s.id,
    label: s.name,
    dot: s.is_active ? 'var(--success)' : 'var(--text-muted)',
  }))

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Chọn site"
      leadingIcon={<Globe size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
      minWidth={180}
      footer={
        <a href="/admin/sites" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', fontSize: '12.5px', color: 'var(--text-secondary)', textDecoration: 'none', borderRadius: 'var(--radius-sm)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <Plus size={14} /> Quản lý sites
        </a>
      }
    />
  )
}
