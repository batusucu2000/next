'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ===== Helpers ===== */
const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x }
const nextHour = (hhmm) => `${pad(Number(hhmm.split(':')[0]) + 1)}:00`
const todayISO = () => fmtDate(new Date())

const trDate = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const day = d.toLocaleDateString('tr-TR', { day: '2-digit' })
  const month = cap(d.toLocaleDateString('tr-TR', { month: 'long' }))
  const year = d.getFullYear()
  const weekday = cap(d.toLocaleDateString('tr-TR', { weekday: 'long' }))
  return `${day} ${month} ${year} ${weekday}`
}

/* Saatleri GÜNE göre üret:
   - Pzt–Cum: 09:00..20:00 (12 başlangıç)
   - Cmt    : 09:00..16:00 (8 başlangıç)
   - Paz    : hiç slot yok
*/
const hoursFor = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const dow = d.getDay() // 0: Pazar, 6: Cumartesi
  if (dow === 0) return [] // Pazar yok
  const start = 9
  const end = (dow === 6) ? 16 : 20
  const len = end - start + 1
  return Array.from({ length: len }, (_, i) => `${pad(start + i)}:00`)
}

export default function AdminCalendarPage() {
  const router = useRouter()

  // Takvim: seçilirse tek gün, yoksa 30 gün
  const [pickedDate, setPickedDate] = useState('')
  const [days, setDays] = useState(() => {
    const t = new Date()
    return Array.from({ length: 30 }, (_, i) => fmtDate(addDays(t, i)))
  })

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // { [date]: Slot[] }  Slot: {id,date,time,duration_minutes,status}
  const [slotsByDate, setSlotsByDate] = useState({})
  // booked olan slot id’leri
  const [reserved, setReserved] = useState(new Set())

  useEffect(() => {
    if (pickedDate) setDays([pickedDate])
    else {
      const t = new Date()
      setDays(Array.from({ length: 30 }, (_, i) => fmtDate(addDays(t, i))))
    }
  }, [pickedDate])

  // Giriş kontrolü + range yükleme
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      if (!days.length) return
      await loadRange(days[0], days[days.length - 1])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, days])

  // Realtime: bookings/slots → yenile
  useEffect(() => {
    const ch1 = supabase
      .channel('bookings-live-admin-cal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        if (days.length) loadRange(days[0], days[days.length - 1])
      })
      .subscribe()
    const ch2 = supabase
      .channel('slots-live-admin-cal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
        if (days.length) loadRange(days[0], days[days.length - 1])
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  /* ===== Data yükleme ===== */
  const loadRange = useCallback(async (start, end) => {
    try {
      setLoading(true); setErr(''); setMsg('')

      // 1) Slotlar (free/closed)
      const { data: slots, error: e1 } = await supabase
        .from('slots')
        .select('id, date, time, duration_minutes, status')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      if (e1) throw e1

      const grouped = {}
      const allIds = []
      for (const s of (slots ?? [])) {
        grouped[s.date] ||= []
        grouped[s.date].push(s)
        allIds.push(s.id)
      }
      setSlotsByDate(grouped)

      // 2) BOOKED slotlar — RPC
      if (allIds.length) {
        const { data: bks, error: e2 } = await supabase.rpc('get_reserved_slots', { slot_ids: allIds })
        if (e2) throw e2
        setReserved(new Set((bks ?? []).map(b => b.slot_id)))
      } else {
        setReserved(new Set())
      }
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  /* ===== Durum ===== */
  const statusOf = (date, hhmm) => {
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === hhmm)
    if (!slot) return 'closed'
    if (slot.status === 'closed') return 'closed'
    if (reserved.has(slot.id)) return 'reserved'
    return 'free'
  }

  /* ===== Tek slot toggle ===== */
  const toggleSlotClosed = async (date, time) => {
    try {
      setErr('')
      const cur = statusOf(date, time)
      const list = slotsByDate[date] || []
      const slot = list.find(s => s.time === time)
      const id = `${date}T${time}`

      const willClose = cur !== 'closed'
      const titleTxt  = `${trDate(date)} ${time} — ${nextHour(time)}`
      let confirmText = willClose
        ? `${titleTxt}\nBu saati KAPATMAK istediğinize emin misiniz? (Hastalar bu saatten randevu alamaz)`
        : `${titleTxt}\nBu saati AÇMAK istediğinize emin misiniz?`

      if (cur === 'reserved' && willClose) {
        confirmText += `\n\nDİKKAT: Bu saatte mevcut bir randevu var. Kapatma işlemi mevcut randevuyu silmez, sadece yeni talepleri engeller.`
      }
      const ok = window.confirm(confirmText)
      if (!ok) return

      setMsg('Kaydediliyor…')

      if (!slot) {
        const { error } = await supabase
          .from('slots')
          .insert({
            id,
            date,
            time,
            duration_minutes: 60,
            status: willClose ? 'closed' : 'free'
          })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('slots')
          .update({ status: willClose ? 'closed' : 'free' })
          .eq('id', slot.id)
        if (error) throw error
      }

      setMsg(willClose ? 'Saat kapatıldı.' : 'Saat açıldı.')
      await loadRange(days[0], days[days.length - 1])
      setTimeout(() => setMsg(''), 1200)
    } catch (e) {
      setErr(e.message || String(e))
    }
  }

  /* ===== Günü topluca kapat/aç ===== */
  const setWholeDay = async (date, close = true) => {
    try {
      const hours = hoursFor(date)
      if (hours.length === 0) {
        setErr('Bu gün için kapatılacak saat aralığı yok (Pazar).')
        return
      }

      const titleTxt  = trDate(date)
      const confirmText = close
        ? `${titleTxt}\nTÜM günü KAPATMAK istediğinize emin misiniz?`
        : `${titleTxt}\nTÜM günü AÇMAK istediğinize emin misiniz?`
      if (!window.confirm(confirmText)) return

      setErr(''); setMsg('Günlük işlem uygulanıyor…')

      const payload = hours.map(h => ({
        id: `${date}T${h}`,
        date,
        time: h,
        duration_minutes: 60,
        status: close ? 'closed' : 'free'
      }))
      const { error } = await supabase
        .from('slots')
        .upsert(payload, { onConflict: 'id' })
      if (error) throw error

      setMsg(close ? 'Tüm gün kapatıldı.' : 'Tüm gün açıldı.')
      await loadRange(days[0], days[days.length - 1])
      setTimeout(() => setMsg(''), 1400)
    } catch (e) {
      setErr(e.message || String(e))
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={brandStyle}>Takvim Düzenleme</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <label style={{ fontSize:14 }}>
            Gün Seç (ilerisi):
            <input
              type="date"
              min={todayISO()}
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              style={dateInput}
            />
          </label>
          {pickedDate && (
            <button onClick={() => setPickedDate('')} style={btnGhost}>
              ✕ Temizle (Önümüzdeki 30 gün)
            </button>
          )}
        </div>
      </header>

      {/* SCROLLABLE MAIN */}
      <main style={container}>
        <h1 style={h1Style}>Takvim (Admin)</h1>

        <div style={legendRow}>
          <Legend color="#2e7d32" label="Müsait" />
          <Legend color="#c62828" label="Rezerve" />
          <Legend color="#9e9e9e" label="Kapalı" />
        </div>

        {msg && <div style={{ color:'#0a7', margin:'8px 0' }}>{msg}</div>}
        {err && <div style={{ color:'crimson', margin:'8px 0' }}>Hata: {err}</div>}

        <section style={{ display: 'grid', gap: 16, marginTop: 8 }}>
          {days.map(date => {
            const hours = hoursFor(date)
            const allClosed = hours.length > 0 && hours.every(h => statusOf(date, h) === 'closed')
            return (
              <div key={date} style={dayCard}>
                <div style={dayHead}>
                  <div style={{ fontWeight: 700 }}>{trDate(date)}</div>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, opacity: hours.length ? 1 : 0.6 }}>
                    <input
                      type="checkbox"
                      disabled={hours.length === 0}
                      checked={hours.length > 0 && allClosed}
                      onChange={(e) => setWholeDay(date, e.target.checked)}
                    />
                    Tüm günü kapat
                  </label>
                </div>

                {hours.length === 0 ? (
                  <div style={{ fontSize:13, color:'#777' }}>Pazar: slot bulunmuyor.</div>
                ) : (
                  <div style={timeGrid}>
                    {hours.map(h => {
                      const st = statusOf(date, h)
                      const style =
                        st === 'free'     ? timeBtnFree :
                        st === 'reserved' ? timeBtnReserved :
                                            timeBtnClosed
                      return (
                        <button
                          key={h}
                          onClick={() => toggleSlotClosed(date, h)}
                          style={style}
                          title={`${trDate(date)} ${h} — ${nextHour(h)}`}
                        >
                          {h} — {nextHour(h)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}

/* ====== Styles ====== */
// Tam ekran + sütun; main alanı scroll yapacak
const pageStyle  = { background:'#fff', color:'#000', height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Arial, sans-serif' }
const headerStyle= { borderBottom:'1px solid #e5e5e5', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }
const brandStyle = { fontSize:20, fontWeight:'bold' }
const dateInput  = { marginLeft:8, padding:'6px 10px', border:'1px solid #ddd', borderRadius:8 }
const btnGhost   = { background:'#eee', border:'1px solid #ddd', borderRadius:8, padding:'6px 10px', cursor:'pointer' }

// SCROLLABLE container: kalan alanı kapla + overflowY
const container  = { width:'100%', maxWidth:'unset', margin:'0 auto', padding:'20px 32px', flex: 1, overflowY: 'auto' }
const h1Style    = { margin:'0 0 12px 0', color:'#007b55', textAlign:'center' }

const legendRow  = { display:'flex', alignItems:'center', gap:16, marginBottom:8 }
const Legend = ({ color, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <span style={{ width:14, height:14, background:color, borderRadius:4, display:'inline-block', opacity:0.9 }} />
    <span style={{ fontSize:13, color:'#444' }}>{label}</span>
  </div>
)

const dayCard   = { border:'1px solid #cfcfcf', borderRadius:12, padding:16, background:'#fafafa' }
const dayHead   = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }
const timeGrid  = { display:'grid', gap:14, gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))' }

const baseBtn        = { borderRadius:14, padding:'14px 16px', fontWeight:600, fontSize:17, lineHeight:1.2, cursor:'pointer', border:'1px solid transparent', background:'#fff', minWidth:240, textAlign:'center' }
const timeBtnFree    = { ...baseBtn, borderColor:'#2e7d32', color:'#2e7d32' }
const timeBtnClosed  = { ...baseBtn, borderColor:'#9e9e9e', color:'#9e9e9e', background:'#f1f1f1' }
const timeBtnReserved= { ...baseBtn, borderColor:'#c62828', color:'#fff', background:'#c62828' }
