'use client'
import { TextInput, type TextInputProps } from '@mantine/core'
import { Search } from 'lucide-react'

/** Ô tìm kiếm chuẩn của thanh công cụ: icon kính lúp, rộng 300px (100% trên mobile). */
export default function SearchInput({ w = { base: '100%', sm: 300 }, ...props }: TextInputProps) {
  return <TextInput w={w} leftSection={<Search size={16} />} {...props} />
}
