'use client'
import { Switch, Tooltip, useMantineTheme, type SwitchProps } from '@mantine/core'
import { Check, X } from 'lucide-react'

/** Switch bật/tắt: icon trên núm (check/x) + tooltip mô tả hành động khi bấm. */
export default function StatusSwitch({ checked, onLabel = 'Đang bật', offLabel = 'Đang tắt', ...props }: SwitchProps & {
  checked: boolean
  onLabel?: string
  offLabel?: string
}) {
  const theme = useMantineTheme()
  return (
    <Tooltip label={checked ? `${onLabel} · bấm để tắt` : `${offLabel} · bấm để bật`} withArrow>
      <Switch
        checked={checked}
        thumbIcon={checked
          ? <Check size={12} strokeWidth={3} color={theme.colors.brand[6]} />
          : <X size={12} strokeWidth={3} color={theme.colors.gray[6]} />}
        {...props}
      />
    </Tooltip>
  )
}
