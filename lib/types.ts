// ─── Core entities ────────────────────────────────────────────────────────────

export interface Site {
  id: string
  name: string
  placements: Record<string, PlacementConfig>
  image_domain_id?: string
  image_base_url?: string
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface PlacementConfig {
  label: string
  limit: number
  default_mode: 'fixed' | 'rotate'
}

export interface ImageDomain {
  id: string
  base_url: string
  is_active: boolean
  is_blocked: boolean
  assigned_to?: string
  site_name?: string
  created_at?: string
}

export interface Brand {
  id: string
  name: string
  domain: string
  login_url: string       // computed: = domain
  logo_url: string
  button_image: string
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface BrandDomainHistory {
  id: string
  brand_id: string
  old_domain: string
  new_domain: string
  changed_at: string
}

export interface Banner {
  id: string
  brand_id?: string
  placement: string
  title: string
  image_url: string       // built from image_key + base_url
  click_url: string
  file_hash?: string
  file_size?: number
  is_active: boolean
  is_deleted?: boolean
  created_at?: string
  updated_at?: string
}

export interface Slot {
  id: string
  site_id: string
  placement: string
  position: number
  display_mode: 'fixed' | 'rotate'
  is_active: boolean
  slot_style?: Record<string, any> | null
  banners: SlotBanner[]
  // Button slot — brand gắn trực tiếp vào slot
  brand_id?: string | null
  brand_name?: string | null
  brand_logo_url?: string | null
}

export interface SlotBanner extends Banner {
  order_in_rotation: number
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface SlotsResponse {
  [placement: string]: Slot[]
}

// ─── UI constants ─────────────────────────────────────────────────────────────

export const PLACEMENT_COLORS: Record<string, string> = {
  catfish:      '#0891B2',
  button:       '#7C3AED',
  popup:        '#DB2777',
  slider:       '#059669',
  'brand-button': '#EA580C',
}

// Lucide icon names — resolved in components via icon map
export const PLACEMENT_ICONS: Record<string, string> = {
  catfish:      'Fish',
  button:       'MousePointerClick',
  popup:        'MessageSquare',
  slider:       'GalleryHorizontalEnd',
  'brand-button': 'Tag',
}
