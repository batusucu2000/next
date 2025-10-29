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

      // profiles'tan oku
      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('id', user.id)
        .single()

      const first = prof?.first_name ?? user.user_metadata?.first_name ?? ''
      const last  = prof?.last_name  ?? user.user_metadata?.last_name  ?? ''
      let full = [first, last].filter(Boolean).join(' ').trim()

      if (!full) {
        // Telefonu +90 5xx *** ** ** şeklinde kısmi göster (opsiyonel)
        const phone = prof?.phone ?? user.phone ?? user.user_metadata?.phone ?? ''
        const d = (phone.match(/\d/g) || []).join('')
        if (d.length >= 10) {
          const nat10 = d.slice(-10) // 5xxxxxxxxx
          full = `+90 ${nat10.slice(0,3)} ${nat10.slice(3,6).replace(/\d/g,'*')} ${nat10.slice(6,8).replace(/\d/g,'*')} ${nat10.slice(8)}` // +90 5xx *** ** xx
        } else {
          full = 'Kullanıcı'
        }
      }

      setName(full)
    })()
  }, [router])

  return (
    <div style={{ background: '#fff', color: '#000', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <TopBar title="Danışan Randevu Sistemi" nav={nav} />
      <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px' }}>
        {/* Hoş geldin satırı */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 12px', border:'1px solid #eaeaea', borderRadius:10, marginBottom:12, background:'#fafafa'
        }}>
          <div style={{ fontSize:16 }}>
            Hoş geldin, <b>{name || '...'}</b> 👋
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
