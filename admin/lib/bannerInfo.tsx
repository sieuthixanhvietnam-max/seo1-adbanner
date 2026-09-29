'use client'
import { Badge, Group, Text, Tooltip } from '@mantine/core'
import type { Banner } from '@/lib/types'

/** Thông tin hiển thị của banner (định dạng, dung lượng, ngày upload, mới/cũ) dùng chung Banner Pool và Slot Manager. */
export const HEAVY_BYTES = 500 * 1024

export const fmtSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
export const isHeavy = (b: Banner) => (b.file_size || 0) > HEAVY_BYTES

export const NEW_DAYS = 7
export const OLD_DAYS = 90
export const DAY_MS = 24 * 60 * 60 * 1000

// SQLite CURRENT_TIMESTAMP là UTC dạng "YYYY-MM-DD HH:MM:SS"
export const uploadedAt = (b: Banner) => {
  const t = b.created_at ? new Date(b.created_at.replace(' ', 'T') + 'Z').getTime() : NaN
  return Number.isNaN(t) ? null : t
}
export const ageDays = (b: Banner) => { const t = uploadedAt(b); return t === null ? null : (Date.now() - t) / DAY_MS }
export const isNew = (b: Banner) => { const d = ageDays(b); return d !== null && d <= NEW_DAYS }
export const isOld = (b: Banner) => { const d = ageDays(b); return d !== null && d > OLD_DAYS }

export const timeAgo = (b: Banner) => {
  const t = uploadedAt(b)
  if (t === null) return '—'
  const sec = Math.max(0, (Date.now() - t) / 1000)
  if (sec < 60) return 'vừa xong'
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`
  if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`
  const d = Math.floor(sec / 86400)
  if (d < 30) return `${d} ngày trước`
  if (d < 365) return `${Math.floor(d / 30)} tháng trước`
  return `${Math.floor(d / 365)} năm trước`
}
export const fullDate = (b: Banner) => {
  const t = uploadedAt(b)
  return t === null ? '' : new Date(t).toLocaleString('vi')
}

export const formatOf = (b: Banner) => {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(b.image_url || '')
  const ext = (m?.[1] || '').toLowerCase()
  return ext === 'jpeg' ? 'JPG' : ext ? ext.toUpperCase() : '?'
}
export const FORMAT_COLORS: Record<string, string> = { GIF: 'orange', PNG: 'blue', WEBP: 'teal', JPG: 'lime', AVIF: 'cyan', SVG: 'pink' }

export function FormatBadge({ b, size }: { b: Banner; size?: 'xs' | 'sm' | 'md' }) {
  const f = formatOf(b)
  return (
    <Tooltip label={f === 'GIF' ? 'GIF thường nặng, cân nhắc đổi sang WebP động' : f === 'WEBP' ? 'WebP: nhẹ, hỗ trợ ảnh động' : `Định dạng ${f}`}>
      <Badge size={size} variant="light" color={FORMAT_COLORS[f] || 'gray'}>{f}</Badge>
    </Tooltip>
  )
}

export function AgeBadge({ b, size }: { b: Banner; size?: 'xs' | 'sm' | 'md' }) {
  if (isNew(b)) return <Badge size={size} variant="light" color="green">Mới</Badge>
  if (isOld(b)) return <Tooltip label={`Đã upload hơn ${OLD_DAYS} ngày`}><Badge size={size} variant="light" color="gray">Cũ</Badge></Tooltip>
  return null
}

export function UploadedInfo({ b }: { b: Banner }) {
  return (
    <Tooltip label={fullDate(b) || 'Không rõ ngày upload'}>
      <Group gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed">{timeAgo(b)}</Text>
        <AgeBadge b={b} />
      </Group>
    </Tooltip>
  )
}

