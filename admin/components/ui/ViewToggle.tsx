'use client'
import { Center, SegmentedControl } from '@mantine/core'
import { LayoutGrid, Table2 } from 'lucide-react'
import type { ViewMode } from '@/lib/useViewMode'

/** Chuyển Bảng/Thẻ — thứ tự và nhãn thống nhất mọi trang (Bảng trước, Thẻ sau). */
export default function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <SegmentedControl value={value} onChange={v => onChange(v as ViewMode)}
      data={[
        { value: 'table', label: <Center style={{ gap: 8 }}><Table2 size={16} /><span>Bảng</span></Center> },
        { value: 'cards', label: <Center style={{ gap: 8 }}><LayoutGrid size={16} /><span>Thẻ</span></Center> },
      ]} />
  )
}
