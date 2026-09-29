'use client'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Group, Skeleton, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ImageOff, Layers, RotateCcw, Trash2 } from 'lucide-react'
import Page from '@/components/PageHeader'
import ImageFrame from '@/components/ui/ImageFrame'
import EntityCard from '@/components/ui/EntityCard'
import StatCard from '@/components/ui/StatCard'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { CardGrid, StatGrid } from '@/components/ui/Grids'
import { bannerApi, imgUrl } from '@/lib/api'
import { PLACEMENT_COLORS } from '@/lib/types'

export default function RecyclePage() {
  const [banners, setBanners] = useState<any[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => bannerApi.getRecycle().then(r => {
    if (r.success) setBanners(r.data || [])
    else { setBanners(b => b ?? []); notifications.show({ color: 'red', message: r.message || 'Không tải được thùng rác' }) }
  }).catch((e: any) => {
    setBanners(b => b ?? [])
    notifications.show({ color: 'red', message: e?.message || 'Không tải được thùng rác' })
  })
  useEffect(() => { load() }, [])

  const handleRestore = async (id: string) => {
    setBusy(id)
    try {
      const res = await bannerApi.restore(id)
      if (res.success) notifications.show({ color: 'green', message: 'Đã khôi phục banner.' })
      else notifications.show({ color: 'red', message: res.message || 'Khôi phục thất bại' })
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || 'Khôi phục thất bại' })
    } finally { setBusy(null) }
    load()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (banners || []).filter(b => !q || [b.brand_id, b.placement, b.title].some((v: string) => (v || '').toLowerCase().includes(q)))
  }, [banners, query])

  return (
    <Page title="Recycle Bin" description="Banner đã xóa. Khôi phục để đưa lại vào Banner Pool.">
      <StatGrid>
        <StatCard label="Banner trong thùng rác" icon={Trash2} color="gray"
          loading={banners === null} value={banners?.length ?? 0} hint="Có thể khôi phục bất cứ lúc nào" />
        <StatCard label="Hiển thị theo bộ lọc" icon={Layers} color="gray" loading={banners === null}
          value={filtered.length} of={banners?.length ?? 0} hint={query.trim() ? 'Đang lọc theo từ khóa' : 'Toàn bộ banner đã xóa'} />
      </StatGrid>

      {banners !== null && banners.length > 0 && (
        <Group justify="space-between">
          <SearchInput placeholder="Tìm theo brand, vị trí, tên"
            value={query} onChange={e => setQuery(e.currentTarget.value)} />
          <Text size="sm" c="dimmed">{filtered.length} / {banners.length} banner</Text>
        </Group>
      )}

      {banners === null ? (
        <CardGrid>
          {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={190} />)}
        </CardGrid>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Trash2} color="gray"
          title={banners.length === 0 ? 'Recycle bin trống' : 'Không có banner khớp từ khóa'}
          description={banners.length === 0 ? 'Banner bị xóa sẽ xuất hiện tại đây.' : undefined} />
      ) : (
        <CardGrid>
          {filtered.map(b => (
            <EntityCard key={b.id}
              media={<ImageFrame src={b.image_url ? imgUrl(b.image_url) : null} alt={b.title} h={110}
                style={{ borderBottom: '1px solid var(--mantine-color-default-border)', filter: 'grayscale(0.5)' }} />}
              title={b.brand_id || '—'}
              subtitle={b.title ? <Text size="xs" c="dimmed" truncate>{b.title}</Text> : undefined}
              footer={
                <Button size="compact-sm" variant="light" fullWidth leftSection={<RotateCcw size={14} />}
                  loading={busy === b.id} onClick={() => handleRestore(b.id)}>Khôi phục</Button>
              }>
              {b.placement && (
                <Group><Badge variant="light" color={PLACEMENT_COLORS[b.placement] || 'gray'} tt="none">{b.placement}</Badge></Group>
              )}
            </EntityCard>
          ))}
        </CardGrid>
      )}
    </Page>
  )
}
