'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { bannerApi } from '@/lib/api'
import { imgUrl } from '@/lib/api'
import { Trash2, RotateCcw } from 'lucide-react'

export default function RecyclePage() {
  const [banners, setBanners] = useState<any[]>([])
  const load = () => bannerApi.getRecycle().then(r => { if (r.success) setBanners(r.data || []) })
  useEffect(() => { load() }, [])
  const handleRestore = async (id: string) => { await bannerApi.restore(id); load() }

  return (
    <div>
      <Header title="Recycle Bin" />
      <div style={{ padding: '24px 28px' }}>
        {banners.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Trash2 size={20} /></div>
            <div>Recycle bin trống</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
            {banners.map(b => (
              <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
                <div className="img-frame" style={{ height: '100px', borderBottom: '1px solid var(--border)' }}>
                  {b.image_url ? (
                    <img src={imgUrl(b.image_url)} alt={b.title} style={{ filter: 'grayscale(0.5)' }} />
                  ) : (
                    <Trash2 size={18} color="var(--text-muted)" />
                  )}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brand_id || '—'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{b.placement}</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(b.id)} style={{ width: '100%', justifyContent: 'center' }}>
                    <RotateCcw size={13} /> Khôi phục
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
