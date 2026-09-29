'use client'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { theme } from '@/lib/theme'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider labels={{ confirm: 'Xác nhận', cancel: 'Hủy' }}>
        <Notifications position="top-right" />
        {children}
      </ModalsProvider>
    </MantineProvider>
  )
}
