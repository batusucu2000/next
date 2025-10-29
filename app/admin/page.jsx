'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    (async () => {
      // Oturum var mı?
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // Rol kontrolü
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error || prof?.role !== 'admin') {
        router.replace('/patients') // admin değilse hasta paneline
        return
      }

      // ✅ Admin ise direkt appointments'a gönder
      router.replace('/admin/appointments')
    })()
  }, [router])

  // Küçük bir placeholder
  return <main style={{ padding: 16, fontFamily: 'Arial, sans-serif' }}>Yönlendiriliyor…</main>
}
