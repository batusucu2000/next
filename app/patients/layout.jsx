'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import TopBar from '@/components/TopBar'

export default function PatientsLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState('')

  // Hangi sayfalarda "tam sola yapış" modu açılsın?
  const edgeLeftRoutes = useMemo(
    () => ['/patients/book', '/patients/upcoming'],
    []
  )
  const edgeLeft = edgeLeftRoutes.some(p => pathname?.startsWith(p))

  const nav = useMemo(() => ([
    { href: '/patients/profile',  label: 'Bilgilerimi Güncelle' },
    { href: '/patients/book',     label: 'Randevu Al' },
    { href: '/patients/upcoming', label: 'İleri Tarihli Randevularım' },
    { href: '/patients/history',  label: 'Geçmiş Randevularım' },
  ]), [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('id', user.id)
        .single()

      const first = prof?.first_name ?? user.user_metadata?.first_name ?? ''
      const last  = prof?.last_name  ?? user.user_metadata?.last_name  ?? ''
      let full = [first, last].filter(Boolean).join(' ').trim()

      if (!full) {
        const phone = prof?.phone ?? user.phone ?? user.user_metadata?.phone ?? ''
        const d = (phone?.match(/\d/g) || []).join('')
        if (d.length >= 10) {
          const nat10 = d.slice(-10)
          full = `+90 ${nat10.slice(0,3)} ${nat10.slice(3,6).replace(/\d/g,'*')} ${nat10.slice(6,8).replace(/\d/g,'*')} ${nat10.slice(8)}`
        } else {
          full = 'Kullanıcı'
        }
      }
      setName(full)
    })()
  }, [router])

  return (
    <div
      className={`pl-wrap ${edgeLeft ? 'edge-left' : ''}`}
      style={{ background:'#fff', color:'#000', minHeight:'100vh', fontFamily:'Arial, sans-serif' }}
    >
      <TopBar title="Danışan Randevu Sistemi" nav={nav} />

      {/* Yalnızca mobilde görünen kaydırmalı alt-sekmeler (TopBar'dan bağımsız) */}
      <div className="pl-mobile-tabs" aria-label="Randevu sekmeleri">
        <div className="pl-tabs-scroll">
          {nav.map(item => {
            const active = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`pl-tab ${active ? 'is-active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Normal sayfalarda ortalanmış; edge-left sayfalarda tam genişlik ve sol padding 0 */}
      <div
        className={`pl-container ${edgeLeft ? 'edge-left' : ''}`}
        style={
          edgeLeft
            ? { maxWidth: 'none', margin: '20px 0', padding: '0 16px 0 0' } // SOL 0
            : { maxWidth: 960, margin: '24px auto', padding: '0 16px' }
        }
      >
        <div className="pl-welcome" style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 12px', border:'1px solid #eaeaea', borderRadius:10,
          marginBottom:12, background:'#fafafa'
        }}>
          <div className="pl-welcome-text" style={{ fontSize:16 }}>
            Hoş geldin, <b>{name || '...'}</b> 👋
          </div>
        </div>

        {/* Çocuk içerik */}
        <main className={`pl-main ${edgeLeft ? 'edge-left' : ''}`}>
          {children}
        </main>
      </div>

      {/* Styles */}
      <style>{`
        .pl-wrap { -webkit-overflow-scrolling: touch; }

        /* EDGE-LEFT OVERRIDES */
        .pl-container.edge-left { padding-left: 0 !important; }
        .pl-main.edge-left { padding-left: 0 !important; }
        .pl-container.edge-left .px-container { padding-left: 0 !important; }
        .pl-container.edge-left .px-page     { width: 100% !important; }
        .pl-container.edge-left .px-days-scroll { margin-left: 0 !important; }

        /* ==== MOBİL TABS (yatay kaydırma) ==== */
        .pl-mobile-tabs {
          display: none;           /* desktop'ta gizli */
          border-top: 1px solid #eee;
          border-bottom: 1px solid #eee;
          background: #fff;
        }
        .pl-tabs-scroll {
          display: flex;
          gap: 18px;
          overflow-x: auto;
          overscroll-behavior-inline: contain;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          padding: 10px 14px;
          scroll-snap-type: x proximity;
          mask-image: linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 20px, rgba(0,0,0,1) calc(100% - 20px), rgba(0,0,0,0));
        }
        .pl-tabs-scroll::-webkit-scrollbar { height: 6px; }
        .pl-tabs-scroll::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 999px; }

        .pl-tab {
          text-decoration: none;
          color: #111;
          font-weight: 600;
          padding: 8px 0;
          border-bottom: 2px solid transparent;
          scroll-snap-align: start;
        }
        .pl-tab.is-active {
          color: #2563eb;
          border-bottom-color: #2563eb;
        }

        /* ====== Responsive ====== */
        @media (max-width: 479px) {
          .pl-mobile-tabs { display: block; } /* mobilde göster */
          .pl-container:not(.edge-left) {
            margin: 16px auto;
            padding: 0 12px;
          }
          .pl-welcome {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding: 10px 12px;
          }
          .pl-welcome-text {
            font-size: 15px;
            line-height: 1.35;
            word-break: break-word;
          }
          .pl-container.edge-left { padding-right: 10px; }
        }

        @media (min-width: 480px) and (max-width: 767px) {
          .pl-container:not(.edge-left) { padding: 0 14px; }
        }
      `}</style>
    </div>
  )
}
