'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* TR uzun tarih */
const trLongDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return ''
  const [y, m, d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
  const day = dt.toLocaleDateString('tr-TR', { day: '2-digit' })
  const month = cap(dt.toLocaleDateString('tr-TR', { month: 'long' }))
  const year = dt.getFullYear()
  const weekday = cap(dt.toLocaleDateString('tr-TR', { weekday: 'long' }))
  return `${day} ${month} ${year} ${weekday}`
}

export default function AdminUpcomingAppointments() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const nowIsoMin = useMemo(() => new Date().toISOString().slice(0, 16), [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      await loadAll()
      // realtime: bookings/slots değişince yenile
      const ch1 = supabase.channel('admin-upcoming-bookings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, loadAll)
        .subscribe()
      const ch2 = supabase.channel('admin-upcoming-slots')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, loadAll)
        .subscribe()
      return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
    })()
  }, [router])

  const loadAll = async () => {
    try {
      setLoading(true); setErr('')

      // 1) Sadece 'booked' rezervasyonlar
      const { data: bookings, error: e1 } = await supabase
        .from('bookings')
        .select('id, status, created_at, slot_id, user_id')
        .eq('status', 'booked')
      if (e1) throw e1
      if (!bookings?.length) { setRows([]); return }

      // 2) İlgili slot ve hasta profilleri
      const slotIds = [...new Set(bookings.map(b => b.slot_id).filter(Boolean))]
      const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]

      const [{ data: slots, error: e2 }, { data: profiles, error: e3 }] = await Promise.all([
        supabase.from('slots').select('id, date, time, duration_minutes').in('id', slotIds),
        supabase.from('profiles').select('id, first_name, last_name, phone').in('id', userIds),
      ])
      if (e2) throw e2
      if (e3) throw e3

      const slotMap = new Map((slots ?? []).map(s => [s.id, s]))
      const profMap = new Map((profiles ?? []).map(p => [p.id, p]))

      // 3) Birleştir + sadece GELECEK randevular
      const upcoming = bookings
        .map(b => ({ ...b, slot: slotMap.get(b.slot_id), profile: profMap.get(b.user_id) }))
        .filter(r => {
          if (!r.slot) return false
          const dt = `${r.slot.date}T${r.slot.time}`
          return dt > nowIsoMin
        })
        .sort((a, b) => {
          const ad = `${a.slot.date}T${a.slot.time}`
          const bd = `${b.slot.date}T${b.slot.time}`
          return ad.localeCompare(bd)
        })

      setRows(upcoming)
    } catch (e) {
      setErr(e.message || String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main style={wrap}>
      <h2 style={title}>Yaklaşan Randevular</h2>
      {err && <div style={errBox}>Hata: {err}</div>}

      {rows.length === 0 ? (
        <p>Yaklaşan randevu yok.</p>
      ) : (
        <div className="scroll-vertical" style={scrollArea}>
          <ul style={list}>
            {rows.map(r => {
              const s = r.slot
              const p = r.profile || {}
              const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '(İsim yok)'
              return (
                <li key={r.id} style={card}>
                  <div style={rowTop}>
                    <div>
                      <b>{trLongDate(s.date)}</b> — {s.time} ({s.duration_minutes} dk)
                      <div style={muted}>Hasta: <b>{name}</b></div>
                      <div style={muted}>Tel: {p.phone ?? '-'}</div>
                      <div style={mutedSmall}>Oluşturulma: {new Date(r.created_at).toLocaleString('tr-TR')}</div>
                    </div>
                    <span style={badgeBooked}>Randevu Oluşturuldu</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </main>
  )
}

/* Styles */
const wrap   = { maxWidth: 860, margin: '24px auto', padding: '0 16px', fontFamily: 'Arial, sans-serif', color: '#111' }
const title  = { borderBottom: '2px solid #007b55', paddingBottom: 6, marginBottom: 12 }
const scrollArea = { maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }
const list   = { listStyle: 'none', padding: 0, display: 'grid', gap: 12 }
const card   = { border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, background: '#fafafa' }
const rowTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }
const muted  = { fontSize: 13, color: '#555' }
const mutedSmall = { fontSize: 12, color: '#777' }
const errBox = { color: 'crimson', marginTop: 8 }
const badgeBooked = { border:'1px solid #bce3c7', borderRadius:999, padding:'4px 10px', fontSize:13, fontWeight:700, color:'#1e7e34', background:'#e7f6ec' }
