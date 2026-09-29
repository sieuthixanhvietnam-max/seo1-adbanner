import {
  LayoutGrid, Trophy, Building2, ImageIcon, Server, Trash2,
  Globe, Link2, KeyRound, type LucideIcon,
} from 'lucide-react'

export interface NavItem { href: string; label: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Vận hành',
    items: [
      { href: '/admin/sites',   label: 'Sites',        icon: Globe },
      { href: '/admin/slots',   label: 'Slot Manager', icon: LayoutGrid },
      { href: '/admin/toplist', label: 'Toplist',      icon: Trophy },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      { href: '/admin/brands',  label: 'Brands',      icon: Building2 },
      { href: '/admin/banners', label: 'Banner Pool', icon: ImageIcon },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { href: '/admin/tracking',      label: 'Tracking Links', icon: Link2 },
      { href: '/admin/image-domains', label: 'Image Domains',  icon: Server },
      { href: '/admin/api-clients',   label: 'API Clients',    icon: KeyRound },
      { href: '/admin/recycle',       label: 'Recycle Bin',    icon: Trash2 },
    ],
  },
]
