/** Chính sách mật khẩu — giữ đồng bộ với backend/src/utils/adminAuth.js (backend luôn kiểm tra lại). */
const COMMON = ['password', 'passw0rd', 'admin', 'administrator', 'qwerty', 'letmein', 'welcome', 'iloveyou',
  '123456', '12345678', '111111', '000000', 'abc123', 'seo1', 'banner', 'aeseo1', 'changeme', 'default']

export interface PasswordRule { id: string; label: string; ok: boolean }

export function evaluatePassword(pw: string, current?: string): { rules: PasswordRule[]; ok: boolean; score: number; label: string; color: string } {
  const low = pw.toLowerCase()
  const rules: PasswordRule[] = [
    { id: 'len',     label: 'Tối thiểu 12 ký tự',                          ok: pw.length >= 12 && pw.length <= 128 },
    { id: 'lower',   label: 'Có chữ thường',                               ok: /[a-z]/.test(pw) },
    { id: 'upper',   label: 'Có chữ hoa',                                  ok: /[A-Z]/.test(pw) },
    { id: 'digit',   label: 'Có chữ số',                                   ok: /[0-9]/.test(pw) },
    { id: 'symbol',  label: 'Có ký tự đặc biệt',                           ok: /[^A-Za-z0-9]/.test(pw) },
    { id: 'common',  label: 'Không chứa từ thông dụng (password, admin, 123456, seo1…)', ok: pw.length > 0 && !COMMON.some(w => low.includes(w)) },
    { id: 'repeat',  label: 'Không lặp một ký tự quá 3 lần liên tiếp',     ok: pw.length > 0 && !/(.)\1{3,}/.test(pw) },
  ]
  if (current !== undefined) rules.push({ id: 'diff', label: 'Khác mật khẩu hiện tại', ok: pw.length > 0 && pw !== current })

  const ok = rules.every(r => r.ok)
  const passed = rules.filter(r => r.ok).length
  // Thang 0-4: đạt dần các quy tắc, cộng điểm cho độ dài từ 16 ký tự
  let score = Math.round((passed / rules.length) * 3)
  if (ok && pw.length >= 16) score = 4
  if (!pw) score = 0
  const label = ['Chưa nhập', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][score]
  const color = ['gray', 'red', 'orange', 'yellow', 'green'][score]
  return { rules, ok, score, label, color }
}
