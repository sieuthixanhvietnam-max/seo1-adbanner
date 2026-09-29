const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:4001'
  // Ưu tiên api_url đã lưu (cho phép trỏ tới backend khác khi cần)
  const stored = localStorage.getItem('api_url')
  if (stored) return stored
  // Production: admin & API cùng domain → dùng chính origin hiện tại
  const host = window.location.hostname
  if (host !== 'localhost' && host !== '127.0.0.1') return window.location.origin
  // Dev
  return 'http://localhost:4001'
}
// Chuyển relative image URL → absolute URL trỏ về backend
export const imgUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${getBaseUrl()}${url}`
}

const getToken = () => {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)admin_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

const authHeaders = () => ({ 'x-admin-token': getToken() })
const jsonHeaders = () => ({ 'Content-Type': 'application/json', 'x-admin-token': getToken() })

type ApiRes<T = any> = { success: boolean; data?: T; message?: string; [key: string]: any }

/** Lưu token phiên vào cookie, hết hạn đúng lúc token hết hạn ở server. */
export function setSessionCookie(token: string, expiresAt: number) {
  const secure = location.protocol === 'https:' ? '; Secure; SameSite=Strict' : '; SameSite=Lax'
  document.cookie = `admin_token=${encodeURIComponent(token)}; expires=${new Date(expiresAt).toUTCString()}; path=/${secure}`
}

export function clearSessionCookie() {
  document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<ApiRes<T>> {
  const res = await fetch(`${getBaseUrl()}${path}`, options)
  // Phiên hết hạn hoặc bị thu hồi (đổi mật khẩu ở nơi khác): xóa token, về trang đăng nhập
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login') && !path.startsWith('/auth/change-password')) {
    clearSessionCookie()
    window.location.href = '/login?expired=1'
    return { success: false, message: 'Phiên đăng nhập đã hết hạn.' }
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    return {
      success: false,
      message: `Expected JSON but got ${res.status} ${res.statusText} from ${getBaseUrl()}${path}. Check that the backend is running on the right port. Response starts: ${text.slice(0, 80)}`,
    }
  }
  return res.json()
}

export const siteApi = {
  getAll: () => request('/api/sites', { headers: authHeaders() }),
  getOne: (id: string) => request(`/api/sites/${id}`, { headers: authHeaders() }),
  create: (data: Record<string, any>) => request('/api/sites', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => request(`/api/sites/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/sites/${id}`, { method: 'DELETE', headers: jsonHeaders() }),
}

export const brandApi = {
  getAll: () => request('/api/brands', { headers: authHeaders() }),
  getHistory: (id: string) => request(`/api/brands/history/${id}`, { headers: authHeaders() }),
  create: (formData: FormData) => fetch(`${getBaseUrl()}/api/brands`, { method: 'POST', headers: authHeaders(), body: formData }).then(r => r.json()),
  update: (id: string, formData: FormData) => fetch(`${getBaseUrl()}/api/brands/${id}`, { method: 'PUT', headers: authHeaders(), body: formData }).then(r => r.json()),
  delete: (id: string, force = false) => request(`/api/brands/${id}${force ? '?force=true' : ''}`, { method: 'DELETE', headers: jsonHeaders() }),
  rollback: (id: string, history_id: string) => request(`/api/brands/${id}/rollback`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ history_id }) }),
  bulkImport: (brands: any[]) => request('/api/brands/bulk', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ brands }) }),
  checkDomains: () => request('/api/brands/check-domains', { method: 'POST', headers: jsonHeaders() }),
}

export const toplistApi = {
  getBySite: (siteId: string) => request(`/api/toplist?site_id=${siteId}`, { headers: authHeaders() }),
  create: (formData: FormData) => fetch(`${getBaseUrl()}/api/toplist`, { method: 'POST', headers: authHeaders(), body: formData }).then(r => r.json()),
  update: (id: string, formData: FormData) => fetch(`${getBaseUrl()}/api/toplist/${id}`, { method: 'PUT', headers: authHeaders(), body: formData }).then(r => r.json()),
  reorder: (siteId: string, order: string[]) => request('/api/toplist/reorder', { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ site_id: siteId, order }) }),
  delete: (id: string) => request(`/api/toplist/${id}`, { method: 'DELETE', headers: jsonHeaders() }),
}

export const bannerApi = {
  getAll: (params?: { placement?: string; brand_id?: string }) => {
    const q = new URLSearchParams(params as any).toString()
    return request(`/api/banners${q ? '?' + q : ''}`, { headers: authHeaders() })
  },
  getRecycle: () => request('/api/banners/recycle', { headers: authHeaders() }),
  upload: (formData: FormData) => fetch(`${getBaseUrl()}/api/banners`, { method: 'POST', headers: authHeaders(), body: formData }).then(r => r.json()),
  update: (id: string, data: Record<string, any>) => request(`/api/banners/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) }),
  updateImage: (id: string, formData: FormData) => fetch(`${getBaseUrl()}/api/banners/${id}/image`, { method: 'PUT', headers: authHeaders(), body: formData }).then(r => r.json()),
  delete: (id: string) => request(`/api/banners/${id}`, { method: 'DELETE', headers: jsonHeaders() }),
  restore: (id: string) => request(`/api/banners/${id}/restore`, { method: 'POST', headers: jsonHeaders() }),
}

export const slotApi = {
  getBySite: (siteId: string) => request(`/api/slots?site_id=${siteId}`, { headers: authHeaders() }),
  update: (slotId: string, data: { display_mode?: string; is_active?: boolean; slot_style?: Record<string, any>; brand_id?: string | null }) => request(`/api/slots/${slotId}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) }),
  setBanners: (slotId: string, banners: { banner_id: string; order_in_rotation: number }[]) => request(`/api/slots/${slotId}/banners`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ banners }) }),
  removeBanner: (slotId: string, bannerId: string) => request(`/api/slots/${slotId}/banners/${bannerId}`, { method: 'DELETE', headers: jsonHeaders() }),
}

export const imageDomainApi = {
  getAll: () => request('/api/image-domains', { headers: authHeaders() }),
  generate: (count: number) => request('/api/image-domains/generate', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ count }) }),
  update: (id: string, data: Record<string, any>) => request(`/api/image-domains/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/image-domains/${id}`, { method: 'DELETE', headers: jsonHeaders() }),
}

export const apiClientApi = {
  getAll: () => request('/api/api-clients', { headers: authHeaders() }),
  create: (name: string) => request('/api/api-clients', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ name }) }),
  update: (id: string, data: Record<string, any>) => request(`/api/api-clients/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/api-clients/${id}`, { method: 'DELETE', headers: jsonHeaders() }),
}

export const authApi = {
  session: () => request('/auth/session', { headers: authHeaders() }),
  activity: () => request('/auth/activity', { headers: authHeaders() }),
  changePassword: (current_password: string, new_password: string) =>
    request('/auth/change-password', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ current_password, new_password }) }),
}

export const cacheApi = {
  clear: (siteId?: string) => request('/api/cache/clear', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ site_id: siteId }) }),
}

export const trackingApi = {
  getStatus:    ()                          => request('/api/tracking/status', { headers: authHeaders() }),
  getAll:       (params?: { domain?: string; brand_id?: string; page?: number; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])).toString() : ''
    return request(`/api/tracking${qs}`, { headers: authHeaders() })
  },
  saveSheetUrl: (sheet_url: string)        => request('/api/tracking/sheet-url', { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ sheet_url }) }),
  sync:         (sheet_url?: string)       => request('/api/tracking/sync', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ sheet_url }) }),
  delete:       (domain: string, brand_id?: string) => request('/api/tracking', { method: 'DELETE', headers: jsonHeaders(), body: JSON.stringify({ domain, brand_id }) }),
}

export { getBaseUrl, jsonHeaders }
