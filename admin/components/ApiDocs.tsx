'use client'
import {
  Accordion, Alert, Badge, Box, Code, CopyButton, Group, List, Paper, Stack, Table, Tabs, Text, ThemeIcon, Tooltip, ActionIcon,
} from '@mantine/core'
import { Check, Copy, Info, KeyRound, ShieldAlert, Terminal, Zap } from 'lucide-react'

function CodeBlock({ code }: { code: string }) {
  return (
    <Box pos="relative">
      <Code block fz="xs" style={{ paddingRight: 44, whiteSpace: 'pre' }}>{code}</Code>
      <CopyButton value={code} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Đã copy' : 'Copy'} withArrow>
            <ActionIcon variant="default" pos="absolute" top={6} right={6} onClick={copy} aria-label="Copy đoạn mã">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Box>
  )
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Paper p="md">
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={30} variant="light" radius="md"><Icon size={16} strokeWidth={1.8} /></ThemeIcon>
          <Text fw={600}>{title}</Text>
        </Group>
        {children}
      </Stack>
    </Paper>
  )
}

interface Param { name: string; where: string; required: boolean; desc: string }
interface Endpoint { path: string; title: string; desc: string; params?: Param[]; response: string; note?: string }

/** Tài liệu API nội bộ /api/ext/v1 — ví dụ dùng địa chỉ máy chủ hiện tại và key mẫu. */
export default function ApiDocs({ base }: { base: string }) {
  const B = base || 'https://banners.aeseo1.com'
  const KEY = 'sk1_xxxxxxxxxxxxxxxx'

  const endpoints: Endpoint[] = [
    {
      path: '/api/ext/v1/health', title: 'Kiểm tra key và kết nối',
      desc: 'Trả về tên dịch vụ ứng với key. Dùng để thử key mới hoặc giám sát.',
      response: `{ "success": true, "data": { "status": "ok", "client": "redirect-monitor" } }`,
    },
    {
      path: '/api/ext/v1/sites', title: 'Danh sách site',
      desc: 'Các site đang bật (sắp xếp theo thứ tự hiển thị rồi tên).',
      response: `{
  "success": true,
  "data": [
    { "id": "nganh-s", "name": "Ngành S", "domain": "nganh-s.com", "site_type": "nganh-s" }
  ]
}`,
    },
    {
      path: '/api/ext/v1/sites/:id/banners', title: 'Banner và slot của một site',
      desc: 'Cùng cấu trúc với API mà plugin WordPress dùng: các slot theo placement, brand, toplist. Dữ liệu được cache tối đa 60 giây.',
      params: [{ name: 'id', where: 'đường dẫn', required: true, desc: 'Mã site, lấy từ /sites' }],
      response: `{
  "success": true,
  "data": {
    "banners_catfish": [
      { "position": 1, "mode": "fixed", "brand_id": "net88",
        "banner": { "id": "ebc542f5-…", "brand_id": "net88", "title": "",
                    "image_url": "/wp-content/uploads/banners/1789974003131-2d2694a0.gif",
                    "click_url": null },
        "slot_style": null }
    ],
    "banners_button": [
      { "position": 1, "mode": "fixed", "brand_id": "gem88", "brand_name": "Gem88",
        "click_url": "https://gem88event.com" }
    ],
    "brands":  [ { "id": "net88", "name": "Net88", "button_image": "…" } ],
    "toplist": [ { "rank": 1, "brand_id": "net88", "name": "Net88", "image_url": "…" } ],
    "site_type": "nganh-s"
  }
}`,
      note: 'image_url là đường dẫn tương đối: ghép thêm địa chỉ máy chủ phía trước. click_url là null nghĩa là dùng login_url của brand (lấy từ /brands).',
    },
    {
      path: '/api/ext/v1/brands', title: 'Danh sách brand',
      desc: 'Các brand đang bật kèm link đăng nhập hiện tại (luôn mới nhất, không cache).',
      response: `{
  "success": true,
  "data": [
    { "id": "net88", "name": "Net88", "login_url": "https://net88.solar",
      "logo_url": "/wp-content/uploads/brands/1784824020809-4a5304d2.png", "button_image": "" }
  ]
}`,
    },
    {
      path: '/api/ext/v1/toplist?site=:id', title: 'Bảng xếp hạng của một site',
      desc: 'Các brand trong toplist của site, sắp theo hạng.',
      params: [{ name: 'site', where: 'query', required: true, desc: 'Mã site, lấy từ /sites' }],
      response: `{
  "success": true,
  "data": [
    { "rank": 1, "brand_id": "net88", "name": "Net88", "image_url": "/wp-content/uploads/brands/1784824020809-4a5304d2.png" }
  ]
}`,
    },
  ]

  const curl = `curl -H "Authorization: Bearer ${KEY}" \\
  "${B}/api/ext/v1/sites"`

  const js = `const BASE = "${B}";
const KEY = process.env.SEO1_API_KEY; // lưu key trong biến môi trường

async function api(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: \`Bearer \${KEY}\` } });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || res.status);
  return json.data;
}

const [banners, brands] = await Promise.all([
  api("/api/ext/v1/sites/nganh-s/banners"),
  api("/api/ext/v1/brands"),
]);

// Link khi bấm banner: ưu tiên click_url riêng, nếu null thì dùng link đăng nhập của brand
const loginUrl = Object.fromEntries(brands.map(b => [b.id, b.login_url]));
for (const slot of banners.banners_catfish) {
  const b = slot.banner;
  if (!b) continue;
  console.log(BASE + b.image_url, "->", b.click_url || loginUrl[b.brand_id]);
}`

  const php = `<?php
$base = "${B}";
$key  = getenv("SEO1_API_KEY");

function seo1_api(string $path) {
    global $base, $key;
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $key"],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true);
    if ($code !== 200 || empty($json["success"])) {
        throw new RuntimeException($json["message"] ?? "HTTP $code");
    }
    return $json["data"];
}

$sites = seo1_api("/api/ext/v1/sites");`

  const py = `import os, requests

BASE = "${B}"
KEY = os.environ["SEO1_API_KEY"]
session = requests.Session()
session.headers["Authorization"] = f"Bearer {KEY}"

def api(path, **params):
    r = session.get(BASE + path, params=params, timeout=8)
    data = r.json()
    if r.status_code != 200 or not data.get("success"):
        raise RuntimeError(data.get("message", r.status_code))
    return data["data"]

sites = api("/api/ext/v1/sites")
toplist = api("/api/ext/v1/toplist", site="nganh-s")`

  return (
    <Stack gap="md">
      <Section icon={Zap} title="Bắt đầu nhanh">
        <List type="ordered" spacing={6} size="sm">
          <List.Item>Ở tab <b>Danh sách key</b>, bấm <b>Tạo key</b> và đặt tên theo dịch vụ sẽ dùng (ví dụ <Code>redirect-monitor</Code>). Mỗi dịch vụ nên có một key riêng.</List.Item>
          <List.Item>Copy key ngay khi nó hiện ra. Key <b>chỉ hiển thị một lần</b>; nếu mất, hãy xóa key đó và tạo key mới.</List.Item>
          <List.Item>Gửi key trong header <Code>Authorization: Bearer &lt;key&gt;</Code> ở mọi request. Thử ngay:</List.Item>
        </List>
        <CodeBlock code={`curl -H "Authorization: Bearer ${KEY}" "${B}/api/ext/v1/health"`} />
        <Text size="sm" c="dimmed">Trả về <Code>{'{ "success": true, ... }'}</Code> là key hợp lệ. Trả về 401 là key sai, đã tắt hoặc đã bị thu hồi.</Text>
      </Section>

      <Section icon={KeyRound} title="Xác thực">
        <Stack gap={6}>
          <Text size="sm">Toàn bộ API chỉ đọc (<Code>GET</Code>) và dùng chung một cách xác thực: header <Code>Authorization: Bearer &lt;key&gt;</Code>.</Text>
          <List size="sm" spacing={4}>
            <List.Item>Không đặt key trong URL hoặc query string (dễ lọt vào log).</List.Item>
            <List.Item>Lưu key trong biến môi trường hoặc kho bí mật của dịch vụ, không commit vào git.</List.Item>
            <List.Item>Key bị lộ: tắt hoặc xóa ngay ở tab Danh sách key rồi tạo key mới. Cột <b>Dùng lần cuối</b> giúp phát hiện key lạ đang hoạt động.</List.Item>
          </List>
        </Stack>
      </Section>

      <Section icon={Terminal} title="Ví dụ theo ngôn ngữ">
        <Tabs defaultValue="curl" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="curl">cURL</Tabs.Tab>
            <Tabs.Tab value="js">JavaScript</Tabs.Tab>
            <Tabs.Tab value="php">PHP</Tabs.Tab>
            <Tabs.Tab value="py">Python</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="curl" pt="sm"><CodeBlock code={curl} /></Tabs.Panel>
          <Tabs.Panel value="js" pt="sm"><CodeBlock code={js} /></Tabs.Panel>
          <Tabs.Panel value="php" pt="sm"><CodeBlock code={php} /></Tabs.Panel>
          <Tabs.Panel value="py" pt="sm"><CodeBlock code={py} /></Tabs.Panel>
        </Tabs>
      </Section>

      <Paper p="md">
        <Stack gap="sm">
          <Text fw={600}>Danh sách endpoint</Text>
          <Accordion variant="separated" multiple>
            {endpoints.map(e => (
              <Accordion.Item key={e.path} value={e.path}>
                <Accordion.Control>
                  <Group gap="sm" wrap="nowrap">
                    <Badge variant="light" style={{ flexShrink: 0 }}>GET</Badge>
                    <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>{e.path}</Text>
                    <Text size="sm" c="dimmed" visibleFrom="md" truncate>{e.title}</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Text size="sm">{e.desc}</Text>
                    {e.params && (
                      <Table withTableBorder>
                        <Table.Thead><Table.Tr><Table.Th>Tham số</Table.Th><Table.Th>Vị trí</Table.Th><Table.Th>Bắt buộc</Table.Th><Table.Th>Mô tả</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {e.params.map(p => (
                            <Table.Tr key={p.name}>
                              <Table.Td><Code>{p.name}</Code></Table.Td><Table.Td>{p.where}</Table.Td>
                              <Table.Td>{p.required ? 'Có' : 'Không'}</Table.Td><Table.Td>{p.desc}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">Ví dụ phản hồi (200)</Text>
                    <CodeBlock code={e.response} />
                    {e.note && <Alert variant="light" icon={<Info size={16} />} p="xs"><Text size="sm">{e.note}</Text></Alert>}
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">Thử nhanh</Text>
                    <CodeBlock code={`curl -H "Authorization: Bearer ${KEY}" \\\n  "${B}${e.path.replace(':id', 'nganh-s')}"`} />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>
      </Paper>

      <Section icon={ShieldAlert} title="Mã lỗi, giới hạn và lưu ý">
        <Table withTableBorder>
          <Table.Thead><Table.Tr><Table.Th w={80}>Mã</Table.Th><Table.Th>Khi nào</Table.Th><Table.Th>Nội dung trả về</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            <Table.Tr><Table.Td><Badge color="yellow" variant="light">400</Badge></Table.Td><Table.Td>Thiếu tham số bắt buộc</Table.Td><Table.Td><Code>{'{"success":false,"message":"site là bắt buộc!"}'}</Code></Table.Td></Table.Tr>
            <Table.Tr><Table.Td><Badge color="red" variant="light">401</Badge></Table.Td><Table.Td>Thiếu key, key sai, đã tắt hoặc đã thu hồi</Table.Td><Table.Td><Code>{'{"success":false,"message":"Unauthorized"}'}</Code></Table.Td></Table.Tr>
            <Table.Tr><Table.Td><Badge color="gray" variant="light">404</Badge></Table.Td><Table.Td>Site không tồn tại hoặc đường dẫn sai</Table.Td><Table.Td><Code>{'{"success":false,"message":"Site không tồn tại!"}'}</Code></Table.Td></Table.Tr>
            <Table.Tr><Table.Td><Badge color="orange" variant="light">429</Badge></Table.Td><Table.Td>Vượt 300 request/phút cho mỗi key</Table.Td><Table.Td>Chờ theo header <Code>RateLimit-Reset</Code> rồi gọi lại</Table.Td></Table.Tr>
          </Table.Tbody>
        </Table>
        <List size="sm" spacing={4}>
          <List.Item><b>Giới hạn:</b> 300 request/phút cho mỗi key. Nếu gửi quá 30 request bị từ chối (401) trong một phút từ cùng IP, IP đó bị chặn tạm thời.</List.Item>
          <List.Item><b>Header phản hồi hữu ích:</b> <Code>X-Request-Id</Code> (mã truy vết, gửi kèm khi báo lỗi), <Code>RateLimit-Limit</Code>, <Code>RateLimit-Remaining</Code>, <Code>RateLimit-Reset</Code>.</List.Item>
          <List.Item><b>Dữ liệu:</b> mọi phản hồi có <Code>Cache-Control: no-store</Code>. Riêng <Code>/sites/:id/banners</Code> được cache phía máy chủ tối đa 60 giây, còn <Code>/brands</Code> và <Code>/toplist</Code> luôn là dữ liệu mới nhất.</List.Item>
          <List.Item><b>Ảnh:</b> các trường <Code>image_url</Code>, <Code>logo_url</Code>, <Code>button_image</Code> có thể là đường dẫn tương đối. Ghép địa chỉ máy chủ ({B}) phía trước để có URL đầy đủ.</List.Item>
          <List.Item><b>Định dạng:</b> mọi phản hồi là JSON với trường <Code>success</Code>; khi lỗi có thêm <Code>message</Code>.</List.Item>
        </List>
      </Section>
    </Stack>
  )
}
