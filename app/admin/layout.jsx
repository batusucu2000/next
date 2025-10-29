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
    { href: '/admin/history', label: 'Geçmiş Kayıtlar' },
    { href: '/admin/users', label: 'Kullanıcı İşlemleri' },
   
    { href: '/admin/calendar', label: 'Takvim' },
  ]

  return (
    <div style={wrap}>
      {/* ÜST MENÜ */}
      <header style={header}>
        <div style={brand}>Fizyoterapist Paneli</div>

        <nav style={nav}>
          {tabs.map(t => (
            <Link
              key={t.href}
              href={t.href}
              style={{
                ...navLink,
                borderBottom: pathname === t.href ? '2px solid #007b55' : 'none'
              }}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <button onClick={handleLogout} style={btnLogout}>Çıkış Yap</button>
      </header>

      {/* Sayfa içeriği */}
      <main style={{ padding: '24px' }}>{children}</main>
    </div>
  )
}

/* ===== Styles ===== */
const wrap = { background: '#fff', color: '#000', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }
const header = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 32px', borderBottom: '1px solid #ccc', position: 'sticky',
  top: 0, zIndex: 50, background: '#fff'
}
const brand = { fontSize: 20, fontWeight: 'bold' }
const nav = { display: 'flex', gap: '20px', fontSize: 15 }
const navLink = { textDecoration: 'none', color: '#000', paddingBottom: 2 }
const btnLogout = {
  backgroundColor: '#e74c3c', color: 'white', border: 'none',
  padding: '8px 16px', borderRadius: 6, cursor: 'pointer'
}
