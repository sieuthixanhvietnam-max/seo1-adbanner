import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Xanh dương #2563EB — shade 6 (sáng) / shade 4 (tối)
const brand: MantineColorsTuple = [
  '#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA',
  '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A',
]

const xs = { defaultProps: { size: 'xs' } }
const sm = { defaultProps: { size: 'sm' } }

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 4 },
  colors: { brand },
  defaultRadius: 'md',
  // Bóng đổ nhẹ toàn hệ thống: thẻ dùng viền là chính, chỉ menu/popup/modal mới có bóng mờ
  shadows: {
    xs: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 12px rgba(0, 0, 0, 0.07)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.09)',
    xl: '0 12px 32px rgba(0, 0, 0, 0.10)',
  },
  // Chữ nhỏ gọn hơn mặc định Mantine (12/14/16/18/20)
  fontSizes: { xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '18px' },
  fontFamily: "Inter, -apple-system, system-ui, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, monospace",
  headings: { fontFamily: "Inter, -apple-system, system-ui, sans-serif", fontWeight: '600' },
  // Control nhập liệu/nút dùng size xs (cao 30px), phần còn lại size sm — giao diện nhỏ gọn
  components: {
    Button: xs,
    ActionIcon: xs,
    TextInput: xs,
    PasswordInput: xs,
    NumberInput: xs,
    Textarea: xs,
    JsonInput: xs,
    Select: xs,
    MultiSelect: xs,
    Switch: sm,
    Checkbox: sm,
    Radio: sm,
    Chip: sm,
    Badge: { defaultProps: { size: 'sm', radius: 'md' } },
    Pill: { defaultProps: { size: 'sm', radius: 'md' } },
    SegmentedControl: xs,
    FileInput: xs,
    ColorInput: xs,
    Slider: sm,
    Tabs: {},
    Modal: { defaultProps: { size: 'md', radius: 'lg', centered: true, overlayProps: { blur: 2, backgroundOpacity: 0.45 } } },
    Table: { defaultProps: { verticalSpacing: 'xs', highlightOnHover: true } },
    Paper: { defaultProps: { withBorder: true } },
    Card: { defaultProps: { withBorder: true, padding: 'md' } },
  },
})
