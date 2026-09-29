'use client'
import { Box, Card, Group, Stack, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'

/**
 * Card thực thể chuẩn (site, brand, domain, banner…). Bố cục 4 vùng, vùng nào không có thì bỏ:
 *   media   — ảnh/khung xem trước sát mép trên
 *   header  — leading (icon/avatar) + title + subtitle, bên phải là `status` (công tắc/badge)
 *   children — nội dung chính
 *   footer  — hàng thao tác, ngăn cách bằng đường kẻ
 * Trạng thái: `selected` (viền màu chủ đạo), `dimmed` (mờ khi tắt), `onClick` (cả thẻ bấm được).
 */
export default function EntityCard({ media, leading, title, subtitle, status, children, footer, selected = false, dimmed = false, onClick }: {
  media?: React.ReactNode
  leading?: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  status?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
}) {
  const { hovered, ref } = useHover<HTMLDivElement>()
  const hasHeader = leading || title || subtitle || status

  return (
    <Card ref={ref} p={0} onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      cursor: onClick ? 'pointer' : undefined,
      transition: 'border-color 0.12s',
      // Hover nhẹ: chỉ đậm viền một chút, không đổ bóng, không nhấc thẻ
      borderColor: selected ? 'var(--mantine-primary-color-filled)' : hovered ? 'var(--mantine-color-dimmed)' : undefined,
      boxShadow: selected ? '0 0 0 1px var(--mantine-primary-color-filled)' : 'none',
    }}>
      {media}

      <Stack gap="xs" p="sm" style={{ flex: 1, opacity: dimmed ? 0.6 : 1 }}>
        {hasHeader && (
          <Group wrap="nowrap" gap="sm" align="flex-start">
            {leading}
            <Box style={{ flex: 1, minWidth: 0 }}>
              {typeof title === 'string' ? <Text fw={600} truncate>{title}</Text> : title}
              {typeof subtitle === 'string' ? <Text size="xs" c="dimmed" ff="monospace" truncate>{subtitle}</Text> : subtitle}
            </Box>
            {status}
          </Group>
        )}
        {children}
      </Stack>

      {footer && (
        <Group justify="space-between" px="sm" py={4} wrap="nowrap"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-default-hover)' }}>
          {footer}
        </Group>
      )}
    </Card>
  )
}
