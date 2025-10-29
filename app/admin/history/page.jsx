'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ==== Yardımcılar ==== */
const pad = (n) => String(n).padStart(2, '0')
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
const addDaysISO = (yyyyMMdd, n) => {
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  dt.setDate(dt.getDate()+n)
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`
}
const nowIsoMinute = () => new Date().toISOString().slice(0,16)

/* Türkçe uzun tarih formatı */
function trLongDate(yyyyMMdd) {
  if (!yyyyMMdd) return ''
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  const cap = (s) => s ? s.charAt(0).toUpperCase()+s.slice(1) : s
  const day = dt.toLocaleDateString('tr-TR',{day:'2-digit'})
  const month = cap(dt.toLocaleDateString('tr-TR',{month:'long'}))
  const year = dt.getFullYear()
  const weekday = cap(dt.toLocaleDateString('tr-TR',{weekday:'long'}))
  return `${day} ${month} ${year} ${weekday}`
}

export default function AdminHistoryPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [pickedDate, setPickedDate] = useState('')
  const today = useMemo(() => todayISO(), [])
  const nowMin = useMemo(() => nowIsoMinute(), [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      await loadHistory()
    })().catch(e => { setErr(e.message || String(e)); setLoading(false) })
  }, [router])

  async function loadHistory() {
    try {
      setLoading(true); setErr('')

      // sadece approved olanları alıyoruz
      const { data: bookings, error: e1 } = await supabase
        .from('bookings')
        .select('id, status, slot_id, user_id')
        .eq('status', 'approved')
      if (e1) throw e1
      if (!bookings?.length) { setRows([]); return }

      const slotIds = [...new Set(bookings.map(b => b.slot_id).filter(Boolean))]
      const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]

      let slotsById = new Map()
      if (slotIds.length) {
        const { data: slots, error: eS } = await supabase
          .from('slots')
          .select('id, date, time, duration_minutes')
          .in('id', slotIds)
        if (eS) throw eS
        slotsById = new Map((slots ?? []).map(s => [s.id, s]))
      }

      let profilesById = new Map()
      if (userIds.length) {
        const { data: profiles, error: eP } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone')
          .in('id', userIds)
        if (eP) throw eP
        profilesById = new Map((profiles ?? []).map(p => [p.id, p]))
      }

      // yalnızca zamanı geçmiş approved kayıtlar
      const merged = bookings
        .map(b => ({
          ...b,
          slot: slotsById.get(b.slot_id),
          profile: profilesById.get(b.user_id)
        }))
        .filter(r => {
          if (!r.slot) return false
          const dt = `${r.slot.date}T${r.slot.time}`
          return dt <= nowMin // geçmişteyse
        })
        .sort((a,b) => {
          const ad = `${a.slot?.date ?? ''}T${a.slot?.time ?? ''}`
          const bd = `${b.slot?.date ?? ''}T${b.slot?.time ?? ''}`
          return bd.localeCompare(ad)
        })

      setRows(merged)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  /* 30 gün / tarih filtresi */
  const last30Start = addDaysISO(today, -30)
  const filtered = rows
    .filter(r => {
      if (!r.slot) return false
      if (pickedDate) return r.slot.date === pickedDate
      return r.slot.date >= last30Start && r.slot.date <= today
    })

  if (loading) return <main style={{ padding:16 }}>Yükleniyor…</main>

  return (
    <main style={wrap}>
      <h2 style={title}>Geçmiş Randevular</h2>
      {err && <div style={errBox}>Hata: {err}</div>}

      <div style={filterRow}>
        <label style={{ fontSize:14, color:'#333' }}>
          Eski bir gün seç:
          <input
            type="date"
            max={today}
            value={pickedDate}
            onChange={(e) => setPickedDate(e.target.value)}
            style={dateInput}
          />
        </label>
        {pickedDate && (
          <button onClick={() => setPickedDate('')} style={clearBtn}>
            ✕ Temizle (Son 30 gün)
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color:'#555' }}>
          {pickedDate
            ? `${trLongDate(pickedDate)} için tamamlanan randevu yok.`
            : 'Son 30 günde tamamlanan randevu bulunmuyor.'}
        </p>
      ) : (
        <div className="scroll-vertical" style={scrollArea}>
          <ul style={list}>
            {filtered.map(r => {
              const s = r.slot
              const p = r.profile || {}
              const fullName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '(İsim yok)'
              return (
                <li key={r.id} style={card}>
                  <div style={row}>
                    <div>
                      <b>{trLongDate(s.date)}</b> — {s.time} ({s.duration_minutes} dk)
                      <div style={muted}>Hasta: <b>{fullName}</b></div>
                      <div style={muted}>Tel: {p.phone ?? '-'}</div>
                    </div>
                    <span style={badgeDone}>Tamamlandı ✅</span>
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

/* === Styles === */
const wrap   = { maxWidth:860, margin:'24px auto', padding:'0 16px', fontFamily:'Arial, sans-serif', color:'#111', background:'#fff' }
const title  = { borderBottom:'2px solid #007b55', paddingBottom:6, marginBottom:12 }
const filterRow = { display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }
const dateInput = { marginLeft:8, padding:'6px 10px', border:'1px solid #ddd', borderRadius:8 }
const clearBtn  = { background:'#eee', border:'1px solid #ddd', borderRadius:8, padding:'6px 10px', cursor:'pointer' }
const scrollArea = { maxHeight:'60vh', overflowY:'auto', paddingRight:6 }
const list   = { listStyle:'none', padding:0, display:'grid', gap:12 }
const card   = { border:'1px solid #e5e5e5', borderRadius:12, padding:14, background:'#fafafa' }
const row    = { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }
const muted  = { fontSize:13, color:'#555' }
const errBox = { color:'crimson', marginTop:8 }
const badgeDone = {
  border:'1px solid #bce3c7',
  background:'#e7f6ec',
  color:'#1e7e34',
  borderRadius:999,
  padding:'4px 10px',
  fontWeight:700,
  fontSize:13
}
