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

  const tabs = useMemo(() => ([
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
        } else full = 'Kullanıcı'
      }
      setName(full)
    })()
  }, [router])

  return (
    <div className="pl-shell">
      {/* STICKY ÜST BLOK: TopBar (desktop’ta nav görünsün), mobilde gizlenecek */}
      <div className="pl-sticky">
        <TopBar title="Danışan Randevu Sistemi" nav={tabs} />

        {/* MOBİL ÖZEL sekmeler: sadece mobilde görünür, desktop’ta gizli */}
        <nav className="pl-tabs" aria-label="Randevu sekmeleri">
          <div className="pl-tabs-scroll">
            {tabs.map(item => {
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

      {/* TEK SAYFA scroll alanı */}
      <div className="pl-content">
        <div className="pl-welcome">
          <div className="pl-welcome-text">
            Hoş geldin, <b>{name || '...'}</b> 👋
          </div>
        </div>
        <main className="pl-main">{children}</main>
      </div>

      <style>{`
        .pl-shell{
          height:100dvh; min-height:100dvh;
          background:#fff; color:#000; font-family:Arial, sans-serif;
          display:flex; flex-direction:column;
        }
        .pl-sticky{
          position:sticky; top:0; z-index:50; background:#fff;
          border-bottom:1px solid #eee;
        }

        /* MOBİL ÖZEL sekme çubuğu (bizimki) */
        .pl-tabs { display:none; background:#fff; border-top:1px solid #eee; border-bottom:1px solid #eee; }
        .pl-tabs-scroll{
          display:flex; gap:18px;
          overflow-x:auto; white-space:nowrap;
          -webkit-overflow-scrolling:touch; overscroll-behavior-inline:contain;
          scrollbar-width:thin; padding:10px 14px;
          scroll-snap-type:x proximity;
          mask-image: linear-gradient(to right,
            rgba(0,0,0,0), rgba(0,0,0,1) 20px,
            rgba(0,0,0,1) calc(100% - 20px), rgba(0,0,0,0));
        }
        .pl-tabs-scroll::-webkit-scrollbar{ height:6px; }
        .pl-tabs-scroll::-webkit-scrollbar-thumb{ background:#d0d0d0; border-radius:999px; }
        .pl-tab{
          text-decoration:none; color:#111; font-weight:600;
          padding:10px 0; border-bottom:2px solid transparent;
          scroll-snap-align:start;
        }
        .pl-tab.is-active{ color:#2563eb; border-bottom-color:#2563eb; }

        /* İÇERİK alanı dikey scroll alır */
        .pl-content{
          flex:1; overflow:auto; -webkit-overflow-scrolling:touch;
          max-width:960px; width:100%; margin:0 auto; padding:16px;
        }
        .pl-welcome{
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px; border:1px solid #eaeaea; border-radius:10px;
          margin-bottom:12px; background:#fafafa;
        }
        .pl-welcome-text{ font-size:16px; }
        .pl-main{ padding:0; }

        /* ===== Mobil davranışlar ===== */
        @media (max-width: 767px){
          /* TopBar içindeki nav'ı GİZLE (mobilde) */
          .pl-sticky :where(nav){ display:none !important; }

          /* Bizim mobil sekmeyi GÖSTER */
          .pl-tabs{ display:block; }

          /* İçerik tam genişlik */
          .pl-content{ max-width:none; padding:12px 12px; }
          .pl-welcome{
            flex-direction:column; align-items:flex-start; gap:6px; padding:10px 12px;
          }
          .pl-welcome-text{ font-size:15px; line-height:1.35; word-break:break-word; }

          /* Booking sayfasındaki olası sol boşlukları sıfırla */
          .pl-content .px-container{ padding-left:0 !important; }
          .pl-content .px-page{ width:100% !important; }
          .pl-content .px-days-scroll{ margin-left:0 !important; }
        }

        /* ===== Desktop/tablet: TopBar nav AÇIK, bizim mobil sekme KAPALI ===== */
        @media (min-width: 768px){
          /* TopBar nav'ı görünür; (TopBar kendi stilini uygulayacaktır) */
          .pl-sticky :where(nav){ display:flex !important; }
          .pl-tabs{ display:none; }
          .pl-content{ max-width:960px; }
        }
      `}</style>
    </div>
  )
}
