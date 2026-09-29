/** Định dạng ngày giờ dùng chung. SQLite CURRENT_TIMESTAMP là UTC dạng "YYYY-MM-DD HH:MM:SS" (không có hậu tố Z). */
export function parseSqlUtc(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export const fmtDateTime = (s?: string | null, fallback = '—') => {
  const d = parseSqlUtc(s)
  return d ? d.toLocaleString('vi') : fallback
}

export const fmtDate = (s?: string | null, fallback = '—') => {
  const d = parseSqlUtc(s)
  return d ? d.toLocaleDateString('vi') : fallback
}
