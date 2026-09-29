import {
  PanelBottom, SquareMousePointer, Images, AppWindow, Tag, Layers,
} from 'lucide-react'

const map: Record<string, any> = {
  PanelBottom, SquareMousePointer, Images, AppWindow, Tag,
}

export function PlacementIcon({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const Icon = map[name] || Layers
  return <Icon size={size} color={color} strokeWidth={1.8} />
}
