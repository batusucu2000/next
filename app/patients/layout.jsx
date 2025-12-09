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

  // edge-left sadece bu sayfalarda gerekli
  const edgeLeftRoutes = useMemo(() => ['/patients/book', '/patients/upcoming'], [])
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
    <div className={`pl-wrap ${edgeLeft ? 'edge-left' : ''}`}>
      {/* TopBar: masaüstünde aynen görünür. touch'ta nav'ı gizleyeceğiz */}
      <div className="tb-wrap">
        <TopBar title="Danışan Randevu Sistemi" nav={nav} />
      </div>

      {/* Yalnızca touch cihazlarda görünen alt sekmeler */}
      <nav className="pl-mobile-tabs" aria-label="Randevu sekmeleri">
        <div className="pl-tabs-scroll">
          {nav.map(item => {
            const active = pathname?.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`pl-tab ${active ? 'is-active' : ''}`}>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* İçerik konteyneri */}
      <div className={`pl-container ${edgeLeft ? 'edge-left' : ''}`}>
        <div className="pl-welcome">
          <div className="pl-welcome-text">
            Hoş geldin, <b>{name || '...'}</b> 👋
          </div>
        </div>
        <main className={`pl-main ${edgeLeft ? 'edge-left' : ''}`}>{children}</main>
      </div>

      <style jsx>{`
        /* ===== Masaüstü (varsayılan) ===== */
        .pl-wrap { background:#fff; color:#000; min-height:100vh; font-family:Arial, sans-serif; }
        .pl-container { max-width: 960px; margin: 24px auto; padding: 0 16px; }
        .pl-welcome { display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px; border:1px solid #eaeaea; border-radius:10px; margin-bottom:12px; background:#fafafa; }
        .pl-welcome-text { font-size:16px; }
        .pl-mobile-tabs { display:none; } /* masaüstünde asla görünmez */
        .pl-tabs-scroll { display:flex; gap:18px; overflow-x:auto; white-space:nowrap; padding:10px 14px; }
        .pl-tab { text-decoration:none; color:#111; font-weight:600; padding:8px 0; border-bottom:2px solid transparent; }
        .pl-tab.is-active { color:#2563eb; border-bottom-color:#2563eb; }

        /* ===== Sadece dokunmatik cihazlar (telefon/tablet) ===== */
        @media (hover:none) and (pointer:coarse) {
          /* Masaüstünde pencere daraltılsa bile bu kurallar çalışmaz */
          :global(body){ overflow:hidden; } /* tek-sayfa hissi */
          .pl-container { max-width:none; margin:20px 0; padding: 0 12px; }
          .pl-container.edge-left { padding-left: 0; padding-right: 10px; }
          .pl-main.edge-left { padding-left: 0; }
          .pl-mobile-tabs { display:block; border-top:1px solid #eee; border-bottom:1px solid #eee; background:#fff; }
          .pl-tabs-scroll { -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity; }
          .pl-tab { scroll-snap-align:start; }

          /* TopBar içindeki nav’ı touch’ta gizle (eski/ yeni TopBar selektörleri) */
          .tb-wrap :is(.topbar-nav, nav) { display:none !important; }

          /* Book/Upcoming sayfalarının sol boşluklarını sıfırla */
          .pl-container.edge-left :global(.px-container) { padding-left:0 !important; }
          .pl-container.edge-left :global(.px-page) { width:100% !important; }
          .pl-container.edge-left :global(.px-days-scroll) { margin-left:0 !important; }

          /* Karşılama kutusu mobil tipografi */
          .pl-welcome { flex-direction:column; align-items:flex-start; gap:6px; padding:10px 12px; }
          .pl-welcome-text { font-size:15px; line-height:1.35; word-break:break-word; }
        }
      `}</style>
    </div>
  )
}
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

  // edge-left sadece bu sayfalarda gerekli
  const edgeLeftRoutes = useMemo(() => ['/patients/book', '/patients/upcoming'], [])
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
    <div className={`pl-wrap ${edgeLeft ? 'edge-left' : ''}`}>
      {/* TopBar: masaüstünde aynen görünür. touch'ta nav'ı gizleyeceğiz */}
      <div className="tb-wrap">
        <TopBar title="Danışan Randevu Sistemi" nav={nav} />
      </div>

      {/* Yalnızca touch cihazlarda görünen alt sekmeler */}
      <nav className="pl-mobile-tabs" aria-label="Randevu sekmeleri">
        <div className="pl-tabs-scroll">
          {nav.map(item => {
            const active = pathname?.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`pl-tab ${active ? 'is-active' : ''}`}>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* İçerik konteyneri */}
      <div className={`pl-container ${edgeLeft ? 'edge-left' : ''}`}>
        <div className="pl-welcome">
          <div className="pl-welcome-text">
            Hoş geldin, <b>{name || '...'}</b> 👋
          </div>
        </div>
        <main className={`pl-main ${edgeLeft ? 'edge-left' : ''}`}>{children}</main>
      </div>

      <style jsx>{`
        /* ===== Masaüstü (varsayılan) ===== */
        .pl-wrap { background:#fff; color:#000; min-height:100vh; font-family:Arial, sans-serif; }
        .pl-container { max-width: 960px; margin: 24px auto; padding: 0 16px; }
        .pl-welcome { display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px; border:1px solid #eaeaea; border-radius:10px; margin-bottom:12px; background:#fafafa; }
        .pl-welcome-text { font-size:16px; }
        .pl-mobile-tabs { display:none; } /* masaüstünde asla görünmez */
        .pl-tabs-scroll { display:flex; gap:18px; overflow-x:auto; white-space:nowrap; padding:10px 14px; }
        .pl-tab { text-decoration:none; color:#111; font-weight:600; padding:8px 0; border-bottom:2px solid transparent; }
        .pl-tab.is-active { color:#2563eb; border-bottom-color:#2563eb; }

        /* ===== Sadece dokunmatik cihazlar (telefon/tablet) ===== */
        @media (hover:none) and (pointer:coarse) {
          /* Masaüstünde pencere daraltılsa bile bu kurallar çalışmaz */
          :global(body){ overflow:hidden; } /* tek-sayfa hissi */
          .pl-container { max-width:none; margin:20px 0; padding: 0 12px; }
          .pl-container.edge-left { padding-left: 0; padding-right: 10px; }
          .pl-main.edge-left { padding-left: 0; }
          .pl-mobile-tabs { display:block; border-top:1px solid #eee; border-bottom:1px solid #eee; background:#fff; }
          .pl-tabs-scroll { -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity; }
          .pl-tab { scroll-snap-align:start; }

          /* TopBar içindeki nav’ı touch’ta gizle (eski/ yeni TopBar selektörleri) */
          .tb-wrap :is(.topbar-nav, nav) { display:none !important; }

          /* Book/Upcoming sayfalarının sol boşluklarını sıfırla */
          .pl-container.edge-left :global(.px-container) { padding-left:0 !important; }
          .pl-container.edge-left :global(.px-page) { width:100% !important; }
          .pl-container.edge-left :global(.px-days-scroll) { margin-left:0 !important; }

          /* Karşılama kutusu mobil tipografi */
          .pl-welcome { flex-direction:column; align-items:flex-start; gap:6px; padding:10px 12px; }
          .pl-welcome-text { font-size:15px; line-height:1.35; word-break:break-word; }
        }
      `}</style>
    </div>
  )
}
