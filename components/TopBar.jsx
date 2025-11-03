'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function TopBar({ title = 'Hasta Randevu Sistemi', nav = [] }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isActive = (href) =>
    pathname === href ? { borderBottom: '2px solid #007b55' } : {}

  return (
    <header
      className="topbar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #ccc',
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 'bold' }}>{title}</div>

      {/* BURASI ÖNEMLİ: className="topbar-nav" */}
      <nav className="topbar-nav" style={{ display: 'flex', gap: 16, fontSize: 14 }}>
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{ textDecoration: 'none', color: '#000', paddingBottom: 2, ...isActive(item.href) }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        style={{
          backgroundColor: '#e74c3c',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        Çıkış Yap
      </button>

      {/* Mobilde TopBar NAV'INI GİZLE */}
      <style jsx>{`
        @media (hover: none) and (pointer: coarse) {
          .topbar-nav { display: none !important; }
        }
      `}</style>
    </header>
  )
}
