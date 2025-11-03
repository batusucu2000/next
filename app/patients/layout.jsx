'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import TopBar from '@/components/TopBar'

export default function PatientsLayout({ children }) {
  const router = useRouter()
  const [name, setName] = useState('')

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
        } else full = 'Kullanıcı'
      }
      setName(full)
    })()
  }, [router])

  return (
    <div className="pl-shell">
      {/* Sadece TopBar; ekstra mobil sekme YOK */}
      <div className="pl-sticky">
        <TopBar title="Danışan Randevu Sistemi" nav={nav} />
      </div>

      {/* Tek sayfa hissi: yalnızca burası dikey scroll alır */}
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
          height:100dvh; min-height:100dvh; background:#fff; color:#000;
          font-family:Arial, sans-serif; display:flex; flex-direction:column;
        }
        .pl-sticky{
          position:sticky; top:0; z-index:50; background:#fff; border-bottom:1px solid #eee;
        }
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

        /* ---- Mobil: TopBar içindeki nav'ı yatay kaydırmalı yap ---- */
        @media (max-width: 767px){
          /* TopBar içinde render edilen nav'ı hedefliyoruz */
          .pl-sticky nav{
            display:flex !important;
            gap:18px;
            overflow-x:auto;
            white-space:nowrap;
            overscroll-behavior-inline:contain;
            -webkit-overflow-scrolling:touch;
            padding:10px 14px;
            scroll-snap-type:x proximity;
            mask-image: linear-gradient(to right,
              rgba(0,0,0,0), rgba(0,0,0,1) 20px,
              rgba(0,0,0,1) calc(100% - 20px), rgba(0,0,0,0));
          }
          .pl-sticky nav::-webkit-scrollbar{ height:6px; }
          .pl-sticky nav::-webkit-scrollbar-thumb{ background:#d0d0d0; border-radius:999px; }
          .pl-sticky nav a{
            border-bottom:2px solid transparent;
            padding:10px 0;
            font-weight:600;
            scroll-snap-align:start;
          }
          /* Eğer TopBar aktif link'e class/aria veriyorsa renk vurgu burada kalır */
          .pl-content{ max-width:none; padding:12px 12px; }
          .pl-welcome{
            flex-direction:column; align-items:flex-start; gap:6px; padding:10px 12px;
          }
          .pl-welcome-text{ font-size:15px; line-height:1.35; word-break:break-word; }

          /* Booking sayfandaki sol boşlukları sıfırla (varsa) */
          .pl-content .px-container{ padding-left:0 !important; }
          .pl-content .px-page{ width:100% !important; }
          .pl-content .px-days-scroll{ margin-left:0 !important; }
        }
      `}</style>
    </div>
  )
}
