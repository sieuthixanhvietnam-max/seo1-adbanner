# CONVENTIONS.md

## Backend (Node.js / Express)

### Critical Rules
```js
// ✅ dotenv ONLY at top of index.js — never in other files
require('dotenv').config(); // index.js line 1

// ✅ Express 5 wildcard syntax
app.use('/(.*)', handler);   // correct
app.use('*', handler);       // WRONG — throws PathError in Express 5

// ✅ Auth header
headers['x-admin-token'] = token;

// ✅ Sync SQLite (better-sqlite3 is synchronous)
const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
const rows = db.prepare('SELECT * FROM sites').all();
db.prepare('INSERT INTO sites ...').run(values);
```

### Route Pattern
```js
// GET — public or read
router.get('/', (req, res) => { ... });

// POST/PUT/DELETE — require auth via authIfWrite middleware
// Auth is applied at route registration in index.js:
app.use('/api/sites', authIfWrite, sitesRouter);
```

### Response Format
```js
// Success
res.json({ success: true, data: [...], message: 'optional' });

// Error
res.status(400).json({ success: false, message: 'error description' });
```

---

## Admin UI (Next.js / TypeScript)

### Styling Rules
```tsx
// ✅ CSS variables only
style={{ color: 'var(--accent)', background: 'var(--bg-subtle)' }}

// ✅ Use predefined classes
<button className="btn btn-primary">Save</button>
<input className="input" />
<div className="card">...</div>
<div className="empty"><div className="empty-icon"><Icon /></div></div>

// ❌ No Tailwind
className="text-blue-500 bg-gray-100"  // NEVER

// ❌ No emoji
<span>🏆</span>  // NEVER — use Lucide icon
```

### Icon Rules
```tsx
// ✅ Lucide only
import { Trophy, Globe, LayoutGrid } from 'lucide-react'
<Trophy size={16} strokeWidth={1.8} />

// ✅ Placement icons via PlacementIcon
import { PlacementIcon } from '@/lib/icons'
<PlacementIcon name={PLACEMENT_ICONS[placement]} size={15} />
```

### Image Guard (required)
```tsx
// ✅ Always guard empty src
{url ? (
  <img src={url} alt="" loading="lazy" />
) : (
  <div className="empty-icon"><ImageOff size={16} /></div>
)}

// ❌ Never pass empty string to src
<img src={banner.image_url} />  // WRONG if image_url can be ''
```

### Modal Pattern
```tsx
{showModal && (
  <div className="modal-overlay" onClick={() => setShowModal(false)}>
    <div className="modal" style={{ width: '480px' }} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        Title
        <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
      </div>
      <div className="modal-body">...</div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  </div>
)}
```

### API Calls
```typescript
// Use lib/api.ts functions — don't fetch directly
import { siteApi, brandApi } from '@/lib/api'
const res = await siteApi.getAll()
if (res.success) setSites(res.data)
```

---

## WordPress Plugin (PHP)

### API Calls
```php
// ✅ Banner data — use WP transient cache (60s)
$data = AdBanner_API::get_banners();

// ✅ Brand URLs — NEVER cache (must be instant on domain change)
$brand_urls = AdBanner_API::get_brand_urls();
```

### Click URL Resolution
```php
// Always use this 3-tier pattern
public static function resolve_url(array $banner, array $brand_urls): string {
    $bid = $banner['brand_id'] ?? '';
    if (!empty($banner['click_url'])) return $banner['click_url'];
    $tracking = get_option('adbanner_tracking_links', []);
    if (!empty($tracking[$bid])) return $tracking[$bid];
    return $brand_urls[$bid]['login_url'] ?? '#';
}
```

### Slot Rendering (handle both modes)
```php
// ✅ Support both fixed and rotate
$banner = $slot['banner'] ?? null;           // fixed mode
if (!$banner && !empty($slot['banners'])) {  // rotate mode
    $idx = array_rand($slot['banners']);
    $banner = $slot['banners'][$idx];
}
if (!$banner || empty($banner['image_url'])) {
    // render placeholder to keep grid layout
    $html .= "<div style='aspect-ratio:{$ar};'></div>";
    continue;
}
```

### CSS — Anti-footprint
```php
// ✅ Use random prefix (set on plugin activation)
$prefix = get_option('adbanner_prefix', 'adbanner');
// Output: class="e68123-catfish" not "adbanner-catfish"

// ✅ Inject CSS inline for catfish/slider (no separate file)
$html = "<style>.{$prefix}-catfish { ... }</style>";
$html .= "<div class='{$prefix}-catfish'>...</div>";
```

### Image CSS (critical)
```php
// ✅ Use aspect-ratio + object-fit — NEVER fixed height
$html .= "<img style='width:100%;aspect-ratio:{$ar};object-fit:cover;display:block;'>";

// ❌ Never fixed height — causes black gaps
$html .= "<img style='height:90px;'>"; // WRONG
```

### Security
```php
esc_url($url)          // for URLs
esc_html($text)        // for text content
esc_attr($value)       // for HTML attributes
sanitize_text_field()  // for user input
check_ajax_referer()   // for AJAX handlers
```

### Link attributes
```php
// Always on banner links
target='_blank' rel='nofollow noopener'

// Always on images
loading='lazy'
```