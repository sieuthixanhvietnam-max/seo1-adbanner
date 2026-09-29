import type { Metadata } from 'next'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/spotlight/styles.css'
import './globals.css'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Ad Banner Admin',
  description: 'Ad Banner Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
