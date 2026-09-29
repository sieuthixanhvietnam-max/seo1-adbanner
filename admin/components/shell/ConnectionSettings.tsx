'use client'
import { useEffect, useState } from 'react'
import { Button, Group, Modal, PasswordInput, Stack, TextInput } from '@mantine/core'
import { getBaseUrl } from '@/lib/api'

export default function ConnectionSettings({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [apiUrl, setApiUrl] = useState('')
  const [token, setToken] = useState('')

  useEffect(() => {
    if (!opened) return
    setApiUrl(getBaseUrl())
    const m = document.cookie.match(/(?:^|;\s*)admin_token=([^;]*)/)
    setToken(m ? decodeURIComponent(m[1]) : '')
  }, [opened])

  const save = () => {
    localStorage.setItem('api_url', apiUrl.trim())
    window.location.reload()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Kết nối API">
      <Stack>
        <TextInput label="API URL" value={apiUrl} onChange={e => setApiUrl(e.currentTarget.value)}
          placeholder="http://localhost:4001" styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }} />
        <PasswordInput label="Admin token" value={token} readOnly description="Token phiên đăng nhập hiện tại (chỉ đọc)"
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }} />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Hủy</Button>
          <Button onClick={save}>Lưu</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
