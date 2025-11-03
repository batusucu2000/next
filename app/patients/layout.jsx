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

  // Tüm patients rotalarını edge-left yap (mobilde tam genişlik + tek sayfa)
  const edgeLeft = true

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
    <div className={`pl-shell ${edgeLeft ? 'edge-left' : ''}`}>
      {/* STICKY HEADER AREA (TopBar + mobil sekmeler) */}
      <div className="pl-sticky">
        <TopBar title="Danışan Randevu Sistemi" nav={nav} />
        {/* Mobilde görünen yatay kaydırmalı sekmeler */}
        <nav className="pl-mobile-tabs" aria-label="Randevu sekmeleri">
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
        </nav>
      </div>

      {/* SCROLLABLE CONTENT AREA (tek sayfa hissi) */}
      <div
        className={`pl-content ${edgeLeft ? 'edge-left' : ''}`}
      >
        <div className="pl-welcome">
          <div className="pl-welcome-text">
            Hoş geldin, <b>{name || '...'}</b> 👋
          </div>
        </div>

        <main className="pl-main">
          {children}
        </main>
      </div>

      <style>{`
        /* KABUK: tüm sayfayı kapla ve sadece içerik alanını kaydır */
        .pl-shell {
          height: 100dvh;
          min-height: 100dvh;
          background:#fff; color:#000;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* STICKY üst kısım — TopBar + mobil sekmeler birlikte sabit */
        .pl-sticky {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          border-bottom: 1px solid #eee;
        }

        /* İÇERİK alanı: tek sayfa hissi için burası scroll alır */
        .pl-content {
          flex: 1;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          max-width: 960px;
          width: 100%;
          margin: 0 auto;
          padding: 16px;
        }
        .pl-content.edge-left {
          max-width: none;     /* mobilde tam genişlik */
          padding: 12px 12px;  /* kenarlarda az boşluk */
        }

        .pl-welcome {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px; border:1px solid #eaeaea; border-radius:10px;
          margin-bottom:12px; background:#fafafa;
        }
        .pl-welcome-text { font-size:16px; }

        /* Mobil sekmeler (yatay kaydırmalı) */
        .pl-mobile-tabs {
          display: none;
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
          padding: 10px 0;
          border-bottom: 2px solid transparent;
          scroll-snap-align: start;
        }
        .pl-tab.is-active {
          color: #2563eb;
          border-bottom-color: #2563eb;
        }

        /* Çocuk ana içerik */
        .pl-main { padding: 0; }

        /* Mobil davranışlar */
        @media (max-width: 767px) {
          .pl-mobile-tabs { display: block; }         /* sadece mobilde göster */
          .pl-welcome {
            flex-direction: column; align-items: flex-start;
            gap: 6px; padding: 10px 12px;
          }
          .pl-welcome-text { font-size: 15px; line-height: 1.35; word-break: break-word; }

          /* booking sayfandaki eski sol boşlukları sıfırla */
          .pl-content.edge-left .px-container { padding-left: 0 !important; }
          .pl-content.edge-left .px-page { width: 100% !important; }
          .pl-content.edge-left .px-days-scroll { margin-left: 0 !important; }
        }

        /* Tablet/desktop genişlikte ortalı kutu görünümü kalsın */
        @media (min-width: 768px) {
          .pl-content { max-width: 960px; }
        }
      `}</style>
    </div>
  )
}
