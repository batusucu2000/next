'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useEffect } from 'react'

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      // role kontrolü: admin değilse hasta tarafına at
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (prof?.role !== 'admin') return router.replace('/patients')
    })()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const tabs = [
    { href: '/admin/appointments', label: 'Randevularım' },
    { href: '/admin/history',      label: 'Geçmiş Kayıtlar' },
    { href: '/admin/users',        label: 'Kullanıcı İşlemleri' },
    { href: '/admin/calendar',     label: 'Takvim' },
  ]

  return (
    <div className="al-wrap" style={wrap}>
      {/* ÜST MENÜ */}
      <header className="al-header" style={header}>
        <div className="al-toprow">
          <div className="al-brand" style={brand}>Fizyoterapist Paneli</div>
          <button onClick={handleLogout} className="al-logout" style={btnLogout}>Çıkış Yap</button>
        </div>

        <nav className="al-nav" style={nav} aria-label="Yönetim sekmeleri">
          {tabs.map(t => {
            const active = pathname === t.href
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`al-navlink ${active ? 'is-active' : ''}`}
                style={{
                  ...navLink,
                  borderBottom: active ? '2px solid #007b55' : 'none'
                }}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Sayfa içeriği */}
      <main className="al-main" style={{ padding: '24px' }}>{children}</main>

      {/* Düz <style>: SSR/CSR sınıflar birebir; styled-jsx hash yok */}
      <style>{`
        .al-wrap { -webkit-overflow-scrolling: touch; }

        /* Nav linklerinin görünümü */
        .al-navlink {
          text-decoration: none;
          color: #000;
          padding-bottom: 2px;
          display: inline-block;
          line-height: 1.2;
        }

        /* Küçük ekran düzeni */
        @media (max-width: 479px) {
          .al-header {
            padding: 10px 14px;      /* biraz daha kompakt */
          }
          .al-toprow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 6px;      /* alt satırdaki nav'dan ayrıştır */
          }
          .al-brand {
            font-size: 18px;         /* taşmayı önle */
          }
          .al-logout {
            padding: 10px 12px;      /* ≥44px dokunma alanı */
            min-height: 44px;
          }
          .al-nav {
            display: block;
            overflow-x: auto;        /* yatay kaydırma */
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 6px;     /* parmak için alan */
            margin: 0 -14px;         /* kenardan kenara */
            padding-left: 14px;
            padding-right: 14px;
            border-top: 1px solid #eee;
          }
          .al-nav .al-navlink {
            margin-right: 16px;      /* gap yerine margin; nowrap'ta daha kontrollü */
            padding: 10px 0;         /* ≥44px dokunma alanı */
            font-size: 15px;
          }
          .al-main {
            padding: 16px;           /* içerik padding */
          }
        }

        /* Orta ekran: biraz ferah */
        @media (min-width: 480px) and (max-width: 767px) {
          .al-header { padding: 12px 24px; }
          .al-nav { gap: 16px; }
          .al-main { padding: 20px; }
        }

        /* ≥768px: mevcut desktop görünüm korunur, sadece küçük iyileştirmeler */
        @media (min-width: 768px) {
          .al-toprow { display: flex; align-items: center; justify-content: space-between; }
          .al-nav { display: flex; gap: 20px; }
          .al-nav .al-navlink { padding: 12px 0; }
        }
      `}</style>
    </div>
  )
}

/* ===== Styles (inline baz) ===== */
const wrap = { background: '#fff', color: '#000', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }
const header = {
  display: 'flex', flexDirection: 'column', /* mobilde iki satır yapacağız */
  justifyContent: 'center',
  padding: '12px 32px', borderBottom: '1px solid #ccc',
  position: 'sticky', top: 0, zIndex: 50, background: '#fff'
}
const brand = { fontSize: 20, fontWeight: 'bold' }
const nav = { display: 'flex', gap: '20px', fontSize: 15 }
const navLink = { textDecoration: 'none', color: '#000', paddingBottom: 2 }
const btnLogout = {
  backgroundColor: '#e74c3c', color: 'white', border: 'none',
  padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700
}
