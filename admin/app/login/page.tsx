'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert, Box, Button, Center, Collapse, Group, Paper, PasswordInput, Stack, Text, TextInput, ThemeIcon, UnstyledButton,
} from '@mantine/core'
import { AlertCircle, ArrowRight, ChevronDown, History, ImageIcon, Info, TriangleAlert } from 'lucide-react'
import { setSessionCookie } from '@/lib/api'

function getDefaultApiUrl() {
  if (typeof window === 'undefined') return ''
  const { hostname } = window.location
  // Production: cùng origin (OLS proxy → backend)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return window.location.origin
  return 'http://localhost:4001'
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const expired = params.get('expired') === '1'

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [lockLeft, setLockLeft] = useState(0)
  const [capsLock, setCapsLock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiUrl, setApiUrl] = useState('')
  const [showApi, setShowApi] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('api_url')
    // Bỏ qua giá trị cũ trỏ nhầm về cổng của chính admin
    setApiUrl(stored && stored !== 'http://localhost:3000' && stored !== 'http://localhost:3001' ? stored : getDefaultApiUrl())
    inputRef.current?.focus()
  }, [])

  // Đếm ngược thời gian khóa
  useEffect(() => {
    if (lockLeft <= 0) return
    const t = setInterval(() => setLockLeft(n => (n > 1 ? n - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [lockLeft > 0])

  const locked = lockLeft > 0
  const mmss = `${Math.floor(lockLeft / 60)}:${String(lockLeft % 60).padStart(2, '0')}`

  const handleLogin = async () => {
    if (!password || locked) return
    setLoading(true); setError(''); setAttemptsLeft(null)
    try {
      localStorage.setItem('api_url', apiUrl)
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.success) {
        if (data.code === 'LOCKED') { setLockLeft(data.retry_after || 900); setPassword('') }
        else if (typeof data.attempts_left === 'number') setAttemptsLeft(data.attempts_left)
        throw new Error(data.message || 'Đăng nhập thất bại')
      }
      setSessionCookie(data.token, data.expires_at)
      router.push('/admin')
    } catch (e: any) {
      setError(e.message === 'Failed to fetch' ? 'Không kết nối được máy chủ. Kiểm tra lại API URL.' : (e.message || 'Đăng nhập thất bại'))
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-default-hover)">
      <Box w="100%" maw={400}>
        <Paper p={{ base: 'lg', xs: 'xl' }} radius="lg">
          <form onSubmit={e => { e.preventDefault(); handleLogin() }}>
            <Stack gap="lg">
              <Stack align="center" gap="xs">
                <ThemeIcon size={48} radius="md"><ImageIcon size={24} strokeWidth={2} /></ThemeIcon>
                <Box ta="center" lh={1.3}>
                  <Text fw={700} fz="lg">Banner SEO1</Text>
                  <Text size="sm" c="dimmed">Bảng điều khiển quản trị</Text>
                </Box>
              </Stack>

              {expired && !error && (
                <Alert color="blue" icon={<Info size={16} />} p="xs">Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.</Alert>
              )}

              <Stack gap={6}>
                <PasswordInput ref={inputRef} label="Mật khẩu" placeholder="Nhập mật khẩu quản trị" value={password} disabled={locked}
                  autoComplete="current-password" maxLength={256}
                  onChange={e => setPassword(e.currentTarget.value)}
                  onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)} />
                {capsLock && (
                  <Group gap={6}>
                    <TriangleAlert size={14} color="var(--mantine-color-yellow-7)" />
                    <Text size="xs" c="yellow.8">Caps Lock đang bật</Text>
                  </Group>
                )}
              </Stack>

              {locked ? (
                <Alert color="red" icon={<History size={16} />} title="Tạm khóa đăng nhập" p="sm">
                  Đã nhập sai quá nhiều lần. Thử lại sau <Text span fw={700} ff="monospace">{mmss}</Text>.
                </Alert>
              ) : error ? (
                <Alert color="red" icon={<AlertCircle size={16} />} p="xs">
                  {error}
                  {attemptsLeft !== null && attemptsLeft <= 2 && <> Còn <b>{attemptsLeft}</b> lần thử trước khi bị khóa tạm.</>}
                </Alert>
              ) : null}

              <Button type="submit" fullWidth loading={loading} disabled={!password || locked}
                rightSection={<ArrowRight size={16} />}>
                {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>

              <Box>
                <UnstyledButton type="button" onClick={() => setShowApi(v => !v)} aria-expanded={showApi}>
                  <Group gap={4}>
                    <ChevronDown size={14} style={{ transform: showApi ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
                    <Text size="xs" c="dimmed">Cấu hình máy chủ API</Text>
                  </Group>
                </UnstyledButton>
                <Collapse expanded={showApi}>
                  <TextInput mt="xs" aria-label="API URL" value={apiUrl} onChange={e => setApiUrl(e.currentTarget.value)}
                    placeholder="https://banners.aeseo1.com" styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }} />
                </Collapse>
              </Box>
            </Stack>
          </form>
        </Paper>

        <Text size="xs" c="dimmed" ta="center" mt="md">
          Phiên đăng nhập hết hạn sau 12 giờ. Nhập sai 5 lần sẽ bị khóa tạm 15 phút.
        </Text>
      </Box>
    </Center>
  )
}

export default function LoginPage() {
  // useSearchParams cần Suspense khi build tĩnh
  return <Suspense fallback={null}><LoginForm /></Suspense>
}
