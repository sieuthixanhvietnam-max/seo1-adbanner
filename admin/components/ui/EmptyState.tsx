'use client'
import { Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import type { LucideIcon } from 'lucide-react'

/** Trạng thái trống chuẩn: icon tròn, tiêu đề, mô tả và nút hành động tùy chọn. `bare` = không bọc Paper (dùng trong khối đã có khung). */
export default function EmptyState({ icon: Icon, title, description, action, color, bare = false }: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  color?: string
  bare?: boolean
}) {
  const body = (
    <Stack align="center" gap="xs" py="xl">
      <ThemeIcon size={40} radius="xl" variant="light" color={color}><Icon size={20} strokeWidth={1.6} /></ThemeIcon>
      <Text fw={600}>{title}</Text>
      {description && <Text size="sm" c="dimmed" ta="center">{description}</Text>}
      {action}
    </Stack>
  )
  return bare ? body : <Paper p="xl">{body}</Paper>
}
