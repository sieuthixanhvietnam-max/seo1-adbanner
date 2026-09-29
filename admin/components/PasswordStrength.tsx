'use client'
import { Group, Progress, Stack, Text } from '@mantine/core'
import { Check, X } from 'lucide-react'
import { evaluatePassword } from '@/lib/passwordPolicy'

/** Thanh độ mạnh + danh sách quy tắc mật khẩu, cập nhật theo từng ký tự. */
export default function PasswordStrength({ value, current }: { value: string; current?: string }) {
  const { rules, score, label, color } = evaluatePassword(value, current)
  return (
    <Stack gap={8}>
      <Group gap="sm" wrap="nowrap">
        <Progress value={score * 25} color={color} size="sm" style={{ flex: 1 }} aria-label="Độ mạnh mật khẩu" />
        <Text size="xs" fw={600} c={color === 'gray' ? 'dimmed' : color} w={72} ta="right">{label}</Text>
      </Group>
      <Stack gap={2}>
        {rules.map(r => (
          <Group key={r.id} gap={6} wrap="nowrap" align="flex-start">
            {r.ok
              ? <Check size={14} color="var(--mantine-color-green-6)" style={{ marginTop: 2, flexShrink: 0 }} />
              : <X size={14} color="var(--mantine-color-dimmed)" style={{ marginTop: 2, flexShrink: 0 }} />}
            <Text size="xs" c={r.ok ? undefined : 'dimmed'}>{r.label}</Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  )
}
