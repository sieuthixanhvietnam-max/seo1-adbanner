'use client'
import { Box, type BoxProps } from '@mantine/core'
import { ImageOff } from 'lucide-react'

/**
 * Khung ảnh nền ca-rô, hiển thị đủ ảnh (contain), không méo/cắt. Có guard khi chưa có URL.
 * - Mặc định: khung phải có kích thước xác định (w/h/aspectRatio); ảnh lấp đầy khung theo tỉ lệ gốc.
 * - `natural`: khung không có chiều cao cố định (vd modal xem ảnh lớn), ảnh giữ kích thước tự nhiên.
 */
export default function ImageFrame({ src, alt = '', natural = false, ...props }: BoxProps & {
  src?: string | null
  alt?: string
  natural?: boolean
  onClick?: () => void
}) {
  return (
    <Box
      {...props}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        background: 'repeating-conic-gradient(var(--mantine-color-default-hover) 0% 25%, var(--mantine-color-body) 0% 50%) 50% / 14px 14px',
        ...(props.style as object),
      }}
    >
      {src ? (
        <img
          src={src} alt={alt}
          style={natural
            ? { maxWidth: '100%', maxHeight: 'inherit', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }
            : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : <ImageOff size={18} color="var(--mantine-color-dimmed)" />}
    </Box>
  )
}
