'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ===== Helpers ===== */
const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x }
const nextHour = (hhmm) => `${pad(Number(hhmm.split(':')[0]) + 1)}:00`

const trDate = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const day = d.toLocaleDateString('tr-TR', { day: '2-digit' })
  const month = cap(d.toLocaleDateString('tr-TR', { month: 'long' }))
  const year = d.getFullYear()
  const weekday = cap(d.toLocaleDateString('tr-TR', { weekday: 'long' }))
  return `${day} ${month} ${year} ${weekday}`
}

// 09:00–20:00 (12 slot)
const HOURS = Array.from({ length: 12 }, (_, i) => `${pad(9 + i)}:00`)

// Yerel “şimdi”
const nowTR = () => new Date()

// "YYYY-MM-DD" + "HH:MM" → randevu başlangıcına 12 saatten az kaldı mı?
const isWithinLast12h = (yyyyMMdd, hhmm) => {
  try {
    const [y,m,d] = yyyyMMdd.split('-').map(Number)
    const [H,Min] = hhmm.split(':').map(Number)
    const slot = new Date(y,(m||1)-1,d||1,H||0,Min||0,0,0)
    const now  = nowTR()
    const diffH = (slot.getTime() - now.getTime()) / (1000*60*60)
    return diffH <= 12
  } catch { return false }
}

/* ===== Page ===== */
export default function BookPage() {
  const router = useRouter()
  const today = useMemo(() => new Date(), [])
  const days = useMemo(() => Array.from({ length: 15 }, (_, i) => fmtDate(addDays(today, i))), [today])

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [credits, setCredits] = useState(0)

  // { [date]: Slot[] }, reserved: pending/approved/booked dolular
  const [slotsByDate, setSlotsByDate] = useState({})
  const [reserved, setReserved] = useState(new Set())

  // Mesaj zamanlayıcı
  const MESSAGE_TTL_MS = 9000
  const msgTimerRef = useRef(null)
  const clearMsgTimer = () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current) }
  const autoHideMsg = () => {
    clearMsgTimer()
    msgTimerRef.current = setTimeout(() => setMsg(''), MESSAGE_TTL_MS)
  }
  const showMsg = (text) => { setMsg(text); autoHideMsg() }
  const showErr = (text) => { setErr(text); /* istersen hata için de auto-hide ekleyebilirsin */ }

  useEffect(() => () => clearMsgTimer(), [])

  // Tek slot dolu mu? — RPC ile kontrol (RLS güvenli)
  const isSlotBooked = useCallback(async (slotId) => {
    const { data, error } = await supabase.rpc('get_reserved_slots', { slot_ids: [slotId] })
    if (error) return false
    return Array.isArray(data) && data.some(row => row.slot_id === slotId)
  }, [])

  const loadRange = useCallback(async (start, end) => {
    try {
      setLoading(true); setErr(''); /* msg'i silmiyoruz; üstte dursun */

      // Kullanıcı + kredi
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: me } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()
      setCredits(me?.credits ?? 0)

      // Slotlar
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

      // DOLU slotlar (booked)
      if (allIds.length) {
        const { data: bks, error: e2 } = await supabase.rpc('get_reserved_slots', { slot_ids: allIds })
        if (e2) throw e2
        setReserved(new Set((bks ?? []).map(b => b.slot_id)))
      } else {
        setReserved(new Set())
      }
    } catch (e) {
      showErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    ;(async () => {
      await loadRange(days[0], days[days.length-1])
    })()
  }, [days, loadRange])

  // Realtime: bookings/slots değişince tazele
  useEffect(() => {
    const ch1 = supabase
      .channel('bookings-live-patient')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadRange(days[0], days[days.length-1])
      })
      .subscribe()
    const ch2 = supabase
      .channel('slots-live-patient')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
        loadRange(days[0], days[days.length-1])
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [days, loadRange])

  // Durum: 'closed' | 'reserved' | 'free' + 12saat kuralı
  const statusOf = (date, hhmm) => {
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === hhmm)
    if (!slot) return 'closed'
    if (slot.status === 'closed') return 'closed'
    if (reserved.has(slot.id)) return 'reserved'
    if (isWithinLast12h(date, hhmm)) return 'closed'
    return 'free'
  }

  const book = async (date, hhmm) => {
    try {
      const list = slotsByDate[date] || []
      const slot = list.find(s => s.time === hhmm)
      if (!slot) { showErr('Bu saat kapalı.'); return }

      // Uyarı / onay
      const note =
        'NOT: Derse geç kalınması durumunda gecikme süresi ders süresinden düşer.\n\n' +
        `${trDate(date)} ${hhmm} saatine randevu oluşturmak istediğinize emin misiniz?`
      if (!window.confirm(note)) return

      showMsg(`${trDate(date)} ${hhmm} için randevu oluşturuluyor…`)

      // Sunucu tarafı tüm kuralları kontrol eder + krediyi düşer
      const { data, error } = await supabase.rpc('book_slot', { p_slot_id: slot.id })

      // 1) Başarılı
      if (data?.ok) {
        showMsg('Randevunuz oluşturuldu ✅')
        await loadRange(days[0], days[days.length-1])
        return
      }

      // 2) Hata varsa “gerçekten dolu mu?” kontrol et; doluysa başarı say
      if (error) {
        const reallyBooked = await isSlotBooked(slot.id)
        if (reallyBooked) {
          showMsg('Randevunuz oluşturuldu ✅')
          await loadRange(days[0], days[days.length-1])
          return
        }
        showErr(error.message || 'Randevu alınamadı')
        return
      }

      // 3) Ne ok ne error — veride mesaj varsa göster
      showErr(data?.message || 'Randevu alınamadı')
    } catch (e) {
      showErr(e.message || String(e))
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={brandStyle}>Hasta Randevu Sistemi</div>
        <div style={{ fontWeight: 700 }}>Kalan kredi: <span style={{ color:'#007b55' }}>{credits}</span></div>
      </header>

      <main style={container}>
        <h1 style={h1Style}>Randevu Al (Önümüzdeki 15 gün)</h1>

        {/* ---- Mesajlar: TABLONUN ÜSTÜNDE ---- */}
        {msg && (
          <div style={{
            position:'relative', color:'#0a7', background:'#e9fbf6',
            border:'1px solid #b8efe3', padding:'10px 36px 10px 12px',
            borderRadius:8, margin:'6px 0 10px 0'
          }}>
            {msg}
            <button
              onClick={()=>setMsg('')}
              title="Kapat"
              style={{ position:'absolute', right:8, top:6, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}
            >×</button>
          </div>
        )}
        {err && (
          <div style={{
            position:'relative', color:'crimson', background:'#ffeaea',
            border:'1px solid #ffcccc', padding:'10px 36px 10px 12px',
            borderRadius:8, margin:'6px 0 10px 0'
          }}>
            Hata: {err}
            <button
              onClick={()=>setErr('')}
              title="Kapat"
              style={{ position:'absolute', right:8, top:6, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}
            >×</button>
          </div>
        )}
        {/* ------------------------------------ */}

        <div style={legendRow}>
          <Legend color="#2e7d32" label="Müsait" />
          <Legend color="#c62828" label="Dolu" />
          <Legend color="#9e9e9e" label="Kapalı" />
        </div>

        <p style={{ fontSize:13, color:'#555', marginTop:6 }}>
          Kurallar: Aynı güne 1 ders, aynı haftaya en fazla 3 ders. Randevular hafta içi 09:00–20:00 arasında,
          derse 12 saat kala yeni randevu alınamaz. En fazla 15 gün sonrasına rezervasyon yapılabilir.
          İptal ≥24 saat kala → kredi iade; &lt;24 saat kala → iade yok.
        </p>

        {/* SCROLLABLE ALAN */}
        <section className="scroll-vertical" style={daysScroll}>
          <div style={{ display:'grid', gap:16 }}>
            {days.map(date => (
              <div key={date} style={dayCard}>
                <div style={{ fontWeight:700, marginBottom:10 }}>{trDate(date)}</div>
                <div style={timeGrid}>
                  {HOURS.map(h => {
                    const st = statusOf(date, h)
                    const style =
                      st === 'free'     ? timeBtnFree :
                      st === 'reserved' ? timeBtnReserved :
                                          timeBtnClosed
                    return (
                      <button
                        key={h}
                        disabled={st !== 'free'}
                        onClick={() => book(date, h)}
                        style={style}
                        title={`${trDate(date)} ${h} — ${nextHour(h)}`}
                      >
                        {h} — {nextHour(h)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

/* ====== Styles ====== */
const pageStyle  = { background:'#fff', color:'#000', minHeight:'100vh', fontFamily:'Arial, sans-serif' }
const headerStyle= { borderBottom:'1px solid #e5e5e5', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }
const brandStyle = { fontSize:20, fontWeight:'bold' }
const container  = { maxWidth: 1000, margin:'24px auto', padding:'0 16px' }
const h1Style    = { margin:'0 0 12px 0', color:'#007b55', textAlign:'center' }

const legendRow  = { display:'flex', alignItems:'center', gap:16, marginBottom:8 }
const Legend = ({ color, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <span style={{ width:14, height:14, background:color, borderRadius:4, display:'inline-block', opacity:0.9 }} />
    <span style={{ fontSize:13, color:'#444' }}>{label}</span>
  </div>
)

/* Scrollable gün/saat alanı */
const daysScroll = { maxHeight:'60vh', overflowY:'auto', paddingRight:6, marginTop:10, border:'1px solid #eee', borderRadius:12 }

const dayCard   = { border:'1px solid #cfcfcf', borderRadius:12, padding:16, background:'#fafafa' }
const timeGrid  = { display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))' }

const baseBtn        = { borderRadius:10, padding:'10px 12px', fontWeight:600, cursor:'pointer', border:'1px solid transparent', background:'#fff', minWidth:160, textAlign:'center' }
const timeBtnFree    = { ...baseBtn, borderColor:'#2e7d32', color:'#2e7d32' }
const timeBtnClosed  = { ...baseBtn, borderColor:'#9e9e9e', color:'#9e9e9e', cursor:'not-allowed', background:'#f1f1f1' }
const timeBtnReserved= { ...baseBtn, borderColor:'#c62828', color:'#fff', background:'#c62828', cursor:'not-allowed' }
