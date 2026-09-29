'use client'
import { useEffect, useState } from 'react'
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { authApi, setSessionCookie } from '@/lib/api'
import { evaluatePassword } from '@/lib/passwordPolicy'
import PasswordStrength from '@/components/PasswordStrength'

/** Đổi mật khẩu. `forced`: mật khẩu hiện tại không đạt chính sách, không cho đóng cho tới khi đổi xong. */
export default function ChangePasswordModal({ opened, forced, onClose, onDone }: {
  opened: boolean; forced: boolean; onClose: () => void; onDone: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (opened) { setCurrent(''); setNext(''); setConfirm(''); setError('') } }, [opened])

  const policy = evaluatePassword(next, current)
  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit = !!current && policy.ok && confirm === next && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true); setError('')
    const r = await authApi.changePassword(current, next)
    setSaving(false)
    if (!r.success) return setError((r.errors?.length ? `${r.message} ${r.errors.join('; ')}` : r.message) || 'Đổi mật khẩu thất bại')
    // Token cũ đã bị thu hồi; dùng token mới để phiên hiện tại không bị đăng xuất
    setSessionCookie(r.token, r.expires_at)
    notifications.show({ color: 'green', message: r.message || 'Đã đổi mật khẩu.' })
    onDone()
  }

  return (
    <Modal opened={opened} onClose={onClose} size="md" title="Đổi mật khẩu"
      closeOnClickOutside={!forced} closeOnEscape={!forced} withCloseButton={!forced}>
      <form onSubmit={e => { e.preventDefault(); submit() }}>
        <Stack>
          {forced && (
            <Alert color="yellow" icon={<ShieldAlert size={16} />} title="Cần đổi mật khẩu">
              Mật khẩu hiện tại chưa đạt yêu cầu an toàn. Hãy đặt mật khẩu mới để tiếp tục sử dụng hệ thống.
            </Alert>
          )}
          <PasswordInput label="Mật khẩu hiện tại" value={current} autoComplete="current-password" data-autofocus
            onChange={e => setCurrent(e.currentTarget.value)} />
          <PasswordInput label="Mật khẩu mới" value={next} autoComplete="new-password"
            onChange={e => setNext(e.currentTarget.value)} />
          <PasswordStrength value={next} current={current || undefined} />
          <PasswordInput label="Nhập lại mật khẩu mới" value={confirm} autoComplete="new-password"
            error={mismatch ? 'Hai mật khẩu chưa khớp' : undefined} onChange={e => setConfirm(e.currentTarget.value)} />
          {error && <Alert color="red" icon={<AlertCircle size={16} />} p="xs">{error}</Alert>}
          <Text size="xs" c="dimmed">Sau khi đổi, mọi phiên đăng nhập khác (trình duyệt hoặc máy khác) sẽ bị đăng xuất.</Text>
          <Group justify="flex-end">
            {!forced && <Button variant="default" onClick={onClose}>Hủy</Button>}
            <Button type="submit" loading={saving} disabled={!canSubmit}>Đổi mật khẩu</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
