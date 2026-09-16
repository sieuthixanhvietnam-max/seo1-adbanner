'use client'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// Ảnh mẫu placeholder (data URI gradient) để preview
const ph = (label: string, c1 = '#6366F1', c2 = '#8B5CF6') =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='320' height='120' fill='url(%23g)'/><text x='160' y='66' font-family='sans-serif' font-size='16' fill='white' text-anchor='middle' font-weight='600'>${label}</text></svg>`)}`

export function PlacementPreview({ placement, style }: { placement: string; style: any }) {
  const frame: React.CSSProperties = {
    background: '#F1F1F4',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    minHeight: '340px',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  // ─── CATFISH ───
  if (placement === 'catfish') {
    return (
      <div style={frame}>
        <div style={{ position: 'absolute', left: 0, right: 0, [style.position === 'top' ? 'top' : 'bottom']: 0, height: `${style.height}px`, background: style.bgColor, padding: `${style.padding}px`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={ph('CATFISH')} style={{ height: '100%', borderRadius: `${style.borderRadius}px`, objectFit: 'cover' }} />
          {style.closable && (
            <button style={{ position: 'absolute', top: '4px', right: '6px', background: 'transparent', border: 'none', color: style.closeColor, cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
          )}
        </div>
      </div>
    )
  }

  // ─── POPUP ───
  if (placement === 'popup') {
    return (
      <div style={frame}>
        <div style={{ position: 'absolute', inset: 0, background: style.overlayColor, opacity: style.overlayOpacity }} />
        <div style={{ position: 'relative', width: `${Math.min(style.width, 300)}px`, borderRadius: `${style.borderRadius}px`, overflow: 'hidden', padding: `${style.padding}px`, background: '#fff' }}>
          <img src={ph('POPUP')} style={{ width: '100%', display: 'block', borderRadius: `${Math.max(0, style.borderRadius - style.padding)}px` }} />
          {style.closable && (
            <button style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.4)', border: 'none', color: style.closeColor, cursor: 'pointer', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
          )}
        </div>
      </div>
    )
  }

  // ─── SLIDER ───
  if (placement === 'slider') {
    return (
      <div style={frame}>
        <div style={{ width: '80%', position: 'relative' }}>
          <div style={{ borderRadius: `${style.borderRadius}px`, overflow: 'hidden', aspectRatio: style.aspectRatio.replace('/', ' / ') }}>
            <img src={ph('SLIDE 1')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          {style.showArrows && (
            <>
              <button style={arrowBtn('left')}><ChevronLeft size={16} /></button>
              <button style={arrowBtn('right')}><ChevronRight size={16} /></button>
            </>
          )}
          {style.showDots && (
            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border-strong)' }} />)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── BUTTON ───
  if (placement === 'button') {
    return (
      <div style={frame}>
        <div style={{ display: 'flex', flexDirection: style.layout === 'vertical' ? 'column' : 'row', gap: `${style.gap}px`, width: '70%' }}>
          {['net88', '789bet'].map((b, i) => (
            <img key={i} src={ph(b, i ? '#059669' : '#DB2777', i ? '#10B981' : '#F472B6')}
              style={{ flex: 1, height: `${style.height}px`, objectFit: 'cover', borderRadius: `${style.borderRadius}px`, cursor: 'pointer' }} />
          ))}
        </div>
      </div>
    )
  }

  // ─── BRAND-BUTTON ───
  if (placement === 'brand-button') {
    const brands = ['sun', 'go', 'hit', 'rik', '789', 'net88', 'f8', 'k9']
    return (
      <div style={frame}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${style.columns}, 1fr)`, gap: `${style.gap}px`, width: '85%' }}>
          {brands.slice(0, style.columns * 2).map((b, i) => (
            <img key={i} src={ph(b, '#EA580C', '#F97316')}
              style={{ width: '100%', aspectRatio: style.aspectRatio.replace('/', ' / '), objectFit: 'cover', borderRadius: `${style.borderRadius}px` }} />
          ))}
        </div>
      </div>
    )
  }

  // ─── TOPLIST ───
  if (placement === 'toplist') {
    const items = [{ n: 'Net88', r: 1 }, { n: '789Bet', r: 2 }, { n: 'Sunwin', r: 3 }]
    return (
      <div style={{ ...frame, alignItems: 'flex-start', padding: '16px' }}>
        <div style={{ width: '100%', display: style.layout === 'grid' ? 'grid' : 'flex', gridTemplateColumns: style.layout === 'grid' ? `repeat(${style.columns}, 1fr)` : undefined, flexDirection: 'column', gap: `${style.gap}px` }}>
          {items.map((it) => (
            <div key={it.r}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#fff', borderRadius: `${style.borderRadius}px`, border: '1px solid var(--border)' }}>
                {style.showRankBadge && (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px',
                    background: it.r <= 3 ? style.rankColors[it.r - 1] : style.rankBadgeBg,
                    color: it.r <= 3 ? '#000' : style.rankBadgeColor,
                  }}>{it.r}</div>
                )}
                <img src={ph(it.n)} style={{ width: '70px', aspectRatio: style.imageRatio.replace('/', ' / '), objectFit: 'cover', borderRadius: '5px' }} />
                {style.showName && <span style={{ fontWeight: 600, fontSize: '13px' }}>{it.n}</span>}
              </div>
              {style.showDividers && it.r < 3 && <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <div style={frame}><span style={{ color: 'var(--text-muted)' }}>Preview</span></div>
}

const arrowBtn = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: '6px',
  width: '26px', height: '26px', borderRadius: '50%', border: 'none',
  background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: 'var(--shadow-sm)',
})
