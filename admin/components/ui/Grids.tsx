'use client'
import { Children } from 'react'
import { SimpleGrid } from '@mantine/core'

/** Lưới KPI đầu trang: số cột theo số thẻ để các trang trông đồng nhất (3 thẻ = 3 cột, 4 thẻ = 4 cột từ md, 5 thẻ = 5 cột từ xl). */
export function StatGrid({ children }: { children: React.ReactNode }) {
  const n = Children.toArray(children).length
  const cols = n <= 3
    ? { base: 1, xs: Math.max(1, n) }
    : n === 4 ? { base: 1, xs: 2, md: 4 } : { base: 1, xs: 2, md: 3, xl: 5 }
  return <SimpleGrid cols={cols}>{children}</SimpleGrid>
}

/**
 * Lưới card thực thể: 1 cột mobile, 2 cột từ sm, 3 từ lg, 4 từ xl.
 * `maxCols={3}` cho card có tiêu đề dài (vd domain) để không bị cắt chữ.
 */
export function CardGrid({ children, maxCols = 4 }: { children: React.ReactNode; maxCols?: 3 | 4 }) {
  return <SimpleGrid cols={maxCols === 3 ? { base: 1, sm: 2, lg: 3 } : { base: 1, sm: 2, lg: 3, xl: 4 }}>{children}</SimpleGrid>
}
