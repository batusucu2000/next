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
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 32px',
      borderBottom: '1px solid #ccc',
      background: '#fff',
      color: '#000',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ fontSize: 20, fontWeight: 'bold' }}>{title}</div>

      <nav style={{ display: 'flex', gap: 20, fontSize: 15 }}>
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
          padding: '8px 16px',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        Çıkış Yap
      </button>
    </header>
  )
}
