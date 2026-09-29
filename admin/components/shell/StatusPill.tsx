'use client'
import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core'

export type Health = { ok: boolean; ms: number; at: number } | null

const SLOW_MS = 600

/** Trạng thái kết nối API + môi trường, gộp trong một viên: [Môi trường | ● Online 5 ms]. Bấm để kiểm tra lại. */
export default function StatusPill({ health, apiHost, isLocal, checking, onRefresh }: {
  health: Health
  apiHost: string
  isLocal: boolean
  checking: boolean
  onRefresh: () => void
}) {
  const state = !health ? 'checking' : !health.ok ? 'offline' : health.ms > SLOW_MS ? 'slow' : 'ok'
  const color = { checking: 'gray', offline: 'red', slow: 'yellow', ok: 'green' }[state]
  const label = { checking: 'Đang kiểm tra', offline: 'Mất kết nối', slow: 'Chậm', ok: 'Online' }[state]
  const dot = `var(--mantine-color-${color}-6)`

  const tip = (
    <div>
      <Text size="xs" fw={600}>{label}{health?.ok ? ` · ${health.ms} ms` : ''}</Text>
      <Text size="xs" ff="monospace">{apiHost || '—'}</Text>
      <Text size="xs" c="dimmed">
        {health ? `Kiểm tra lúc ${new Date(health.at).toLocaleTimeString('vi')}` : 'Chưa có kết quả'} · bấm để kiểm tra lại
      </Text>
    </div>
  )

  return (
    <Tooltip label={tip} withArrow position="bottom">
      <UnstyledButton onClick={onRefresh} aria-label={`Trạng thái API: ${label}. Bấm để kiểm tra lại`}
        style={{
          display: 'flex', alignItems: 'stretch', height: 32, overflow: 'hidden',
          border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-default)',
          background: 'var(--mantine-color-body)',
        }}>
        <Box visibleFrom="sm" px={10} style={{
          display: 'flex', alignItems: 'center', borderRight: '1px solid var(--mantine-color-default-border)',
          background: isLocal ? 'var(--mantine-color-yellow-light)' : 'var(--mantine-color-brand-light)',
          color: isLocal ? 'var(--mantine-color-yellow-light-color)' : 'var(--mantine-color-brand-light-color)',
        }}>
          <Text size="xs" fw={700} lh={1}>{isLocal ? 'Local' : 'Production'}</Text>
        </Box>
        <Group gap={8} px={10} wrap="nowrap">
          <Box w={8} h={8} style={{
            borderRadius: '50%', background: dot, flexShrink: 0,
            ['--pulse-color' as string]: `var(--mantine-color-${color}-4)`,
            animation: state === 'ok' && !checking ? 'status-pulse 2s infinite' : undefined,
            opacity: checking ? 0.5 : 1,
          }} />
          <Text size="xs" fw={600} lh={1} visibleFrom="sm">{label}</Text>
          {health?.ok && (
            <Text size="xs" ff="monospace" lh={1} visibleFrom="xs" c={state === 'slow' ? 'yellow.8' : 'dimmed'}>{health.ms} ms</Text>
          )}
        </Group>
      </UnstyledButton>
    </Tooltip>
  )
}
