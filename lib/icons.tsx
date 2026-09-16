import {
  Fish, MousePointerClick, MessageSquare, GalleryHorizontalEnd, Tag, Layers,
} from 'lucide-react'

const map: Record<string, any> = {
  Fish, MousePointerClick, MessageSquare, GalleryHorizontalEnd, Tag,
}

export function PlacementIcon({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const Icon = map[name] || Layers
  return <Icon size={size} color={color} strokeWidth={1.8} />
}
