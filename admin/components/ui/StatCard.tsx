'use client'
import { Box, Group, Paper, Progress, Skeleton, Text, ThemeIcon } from '@mantine/core'
import type { LucideIcon } from 'lucide-react'

/**
 * Thẻ KPI đầu trang:
 *   hàng 1: nhãn (trái) — icon nhỏ (phải)
 *   hàng 2: số liệu lớn, kèm "/ tổng" nếu có `of`
 *   hàng 3: thanh tỉ lệ mảnh (chỉ khi có `of`)
 *   hàng 4: chú thích; với màu cảnh báo/lỗi (yellow/red) chú thích đổi màu để gây chú ý
 * `color`: tên màu Mantine hoặc mã hex (mặc định màu chủ đạo).
 */
export default function StatCard({ label, value, icon: Icon, color = 'brand', hint, of, loading = false }: {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  color?: string
  hint?: string
  /** Giá trị tổng để tính tỉ lệ (value/of) */
  of?: number
  loading?: boolean
}) {
  const numeric = typeof value === 'number' ? value : NaN
  const pct = of && of > 0 && !Number.isNaN(numeric) ? Math.min(100, Math.round((numeric / of) * 100)) : null
  const alert = color === 'yellow' || color === 'red'

  return (
    <Paper p="sm">
      <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
        <Text size="xs" c="dimmed" fw={500} truncate>{label}</Text>
        <ThemeIcon size={26} radius="md" variant="light" color={color}><Icon size={15} strokeWidth={1.9} /></ThemeIcon>
      </Group>

      {loading ? <Skeleton h={26} w={64} /> : (
        <Group gap={6} align="baseline" wrap="nowrap">
          <Text fz={24} fw={700} lh={1.2} truncate>{value}</Text>
          {of !== undefined && <Text size="sm" c="dimmed">/ {of}</Text>}
        </Group>
      )}

      {!loading && pct !== null && <Progress value={pct} color={color} size={4} mt={8} aria-label={`${pct}%`} />}

      {!loading && hint && (
        <Box mt={pct !== null ? 6 : 4}>
          <Text size="xs" c={alert ? `${color}.8` : 'dimmed'} truncate>{hint}</Text>
        </Box>
      )}
    </Paper>
  )
}
