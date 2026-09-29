'use client'
import { Box, Group, Stack, Text, Title } from '@mantine/core'

/** Khung trang chuẩn: tiêu đề + mô tả bên trái, hành động bên phải, nội dung bên dưới. */
export default function Page({ title, description, actions, children }: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box p={{ base: 'md', sm: 'xl' }} maw={1440} mx="auto">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Stack gap={2}>
            <Title order={3}>{title}</Title>
            {description && <Text c="dimmed" size="sm">{description}</Text>}
          </Stack>
          {actions && <Group gap="sm">{actions}</Group>}
        </Group>
        {children}
      </Stack>
    </Box>
  )
}
