'use client'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Checkbox, Group, Modal, Select, Skeleton, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Info } from 'lucide-react'
import { PlacementIcon } from '@/lib/icons'
import { siteApi, slotApi } from '@/lib/api'
import type { Banner, Slot, Site } from '@/lib/types'
import { PLACEMENT_COLORS, PLACEMENT_ICONS } from '@/lib/types'

type SiteSlots = Record<string, Slot[]>

/**
 * Gán nhiều banner từ Banner Pool thẳng vào slot của một hoặc nhiều site.
 * Slot đã có banner: thêm vào cuối, bỏ qua ảnh trùng (giống thao tác kéo thả ở Slot Manager).
 * Slot dạng `button` chỉ nhận brand nên không hiển thị.
 */
export default function AssignToSlotsModal({ opened, banners, onClose, onDone }: {
  opened: boolean
  banners: Banner[]
  onClose: () => void
  onDone: () => void
}) {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState<string | null>(null)
  const [cache, setCache] = useState<Record<string, SiteSlots>>({})
  const [loadingSite, setLoadingSite] = useState(false)
  // slotId -> siteId, giữ lựa chọn khi chuyển qua lại giữa các site
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) return
    setPicked({}); setCache({})
    siteApi.getAll().then(r => {
      if (!r.success) return notifications.show({ color: 'red', message: r.message || 'Không tải được danh sách site' })
      const list: Site[] = (r.data || []).filter((s: Site) => s.is_active)
      setSites(list)
      let stored: string | null = null
      try { stored = localStorage.getItem('active_site') } catch {}
      setSiteId(list.some(s => s.id === stored) ? stored : list[0]?.id ?? null)
    })
  }, [opened])

  useEffect(() => {
    if (!opened || !siteId || cache[siteId]) return
    setLoadingSite(true)
    slotApi.getBySite(siteId).then(r => {
      if (r.success) setCache(c => ({ ...c, [siteId]: r.data || {} }))
      else notifications.show({ color: 'red', message: r.message || 'Không tải được slot' })
      setLoadingSite(false)
    })
  }, [opened, siteId, cache])

  const site = sites.find(s => s.id === siteId)
  const groups = useMemo(() => {
    if (!siteId || !cache[siteId]) return []
    return Object.entries(cache[siteId])
      .filter(([placement]) => placement !== 'button')
      .map(([placement, slots]) => ({ placement, label: site?.placements?.[placement]?.label || placement, slots }))
  }, [cache, siteId, site])

  const bannerPlacements = useMemo(() => new Set(banners.map(b => b.placement)), [banners])
  const pickedIds = Object.keys(picked)
  const siteCount = new Set(Object.values(picked)).size
  const toggle = (slotId: string, sid: string) =>
    setPicked(p => { const n = { ...p }; if (n[slotId]) delete n[slotId]; else n[slotId] = sid; return n })

  const assign = async () => {
    setSaving(true)
    let added = 0, dup = 0, failed = 0
    try {
      const bySite: Record<string, string[]> = {}
      for (const [slotId, sid] of Object.entries(picked)) (bySite[sid] ||= []).push(slotId)

      for (const [sid, slotIds] of Object.entries(bySite)) {
        // Lấy lại dữ liệu mới nhất để không ghi đè thay đổi ở tab khác
        const fresh = await slotApi.getBySite(sid)
        if (!fresh.success) { failed += slotIds.length; continue }
        const all: Slot[] = Object.values(fresh.data || {}).flat() as Slot[]
        for (const slotId of slotIds) {
          const slot = all.find(s => s.id === slotId)
          if (!slot) { failed++; continue }
          const have = new Set(slot.banners.map(b => b.id))
          const toAdd = banners.filter(b => !have.has(b.id))
          dup += banners.length - toAdd.length
          if (!toAdd.length) continue
          const order = [...slot.banners.map(b => b.id), ...toAdd.map(b => b.id)]
            .map((id, i) => ({ banner_id: id, order_in_rotation: i }))
          const r = await slotApi.setBanners(slotId, order)
          if (r.success) added += toAdd.length; else failed++
        }
      }
    } finally { setSaving(false) }

    notifications.show({
      color: failed ? 'red' : 'green',
      message: `Đã thêm ${added} lượt gán${dup ? `, bỏ qua ${dup} ảnh đã có trong slot` : ''}${failed ? `, ${failed} slot lỗi` : ''}.`,
    })
    if (added > 0) onDone()
    if (!failed) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} size="lg" title={`Gán ${banners.length} banner vào slot`}>
      <Stack>
        <Select label="Site" searchable allowDeselect={false} placeholder="Chọn site" value={siteId} onChange={setSiteId}
          nothingFoundMessage="Không tìm thấy site" data={sites.map(s => ({ value: s.id, label: s.name }))} />

        {loadingSite || !siteId ? (
          <Stack gap="xs">{[0, 1, 2].map(i => <Skeleton key={i} h={44} />)}</Stack>
        ) : groups.length === 0 ? (
          <Text c="dimmed" size="sm">Site này chưa có slot nhận banner.</Text>
        ) : groups.map(({ placement, label, slots }) => {
          const color = PLACEMENT_COLORS[placement] || '#64748b'
          const matches = bannerPlacements.size === 1 && bannerPlacements.has(placement)
          return (
            <Stack key={placement} gap={6}>
              <Group gap="xs">
                <PlacementIcon name={PLACEMENT_ICONS[placement]} size={16} color={color} />
                <Text fw={600} size="sm" c={color}>{label}</Text>
                {matches && <Badge variant="light" color="green">Khớp vị trí</Badge>}
              </Group>
              <Group gap="xs">
                {slots.map(s => (
                  <Checkbox.Card key={s.id} radius="sm" p="xs" w={{ base: '100%', xs: 'calc(50% - 4px)' }}
                    checked={!!picked[s.id]} onClick={() => toggle(s.id, siteId)} style={{ opacity: s.is_active ? 1 : 0.6 }}>
                    <Group wrap="nowrap" gap="xs">
                      <Checkbox.Indicator />
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600}>Slot #{s.position}{!s.is_active && ' (tắt)'}</Text>
                        <Text size="xs" c="dimmed">{s.display_mode === 'rotate' ? 'Rotate' : 'Fixed'} · {s.banners.length} ảnh</Text>
                      </div>
                    </Group>
                  </Checkbox.Card>
                ))}
              </Group>
            </Stack>
          )
        })}

        <Alert variant="light" icon={<Info size={16} />}>
          Ảnh được thêm vào cuối slot, ảnh đã có sẽ được bỏ qua. Slot Nút bấm chỉ nhận nhà cái nên không hiển thị ở đây.
        </Alert>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">{pickedIds.length ? `Đã chọn ${pickedIds.length} slot ở ${siteCount} site` : 'Chưa chọn slot nào'}</Text>
          <Group>
            <Button variant="default" onClick={onClose}>Hủy</Button>
            <Button onClick={assign} loading={saving} disabled={!pickedIds.length}>Gán vào slot</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
