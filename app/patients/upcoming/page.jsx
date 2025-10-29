'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Helpers */
const nowLocal = () => new Date()
const toDate = (yyyyMMdd, hhmm='00:00') => {
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const [H,Min] = (hhmm||'00:00').split(':').map(Number)
  return new Date(y,(m||1)-1,(d||1), H||0, Min||0, 0, 0)
}
const isFutureLocal = (yyyyMMdd, hhmm) =>
  toDate(yyyyMMdd, hhmm).getTime() >= nowLocal().getTime()

const trLongDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return ''
  const [y, m, d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s
  return `${dt.toLocaleDateString('tr-TR',{day:'2-digit'})} ${cap(dt.toLocaleDateString('tr-TR',{month:'long'}))} ${dt.getFullYear()} ${cap(dt.toLocaleDateString('tr-TR',{weekday:'long'}))}`
}

/* Mesaj otomatik kapanma süresi (ms) */
const MESSAGE_TTL_MS = 8000

export default function UpcomingPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busyCancelId, setBusyCancelId] = useState(null)

  // mesaj zamanlayıcısını yönetmek için ref
  const msgTimerRef = useRef(null)
  const startMsgTimer = () => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    msgTimerRef.current = setTimeout(() => setMsg(''), MESSAGE_TTL_MS)
  }
  const showMsg = (text) => {
    setMsg(text)
    startMsgTimer()
  }
  const showErr = (text) => {
    setErr(text)
    // hata için istersen auto-dismiss de ekleyebilirsin:
    // startMsgTimer()
  }
  useEffect(() => () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current) }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      await load(user.id)

      const ch = supabase
        .channel('patient-upcoming-live')
        .on(
          'postgres_changes',
          { event:'*', schema:'public', table:'bookings', filter:`user_id=eq.${user.id}` },
          () => load(user.id)
        )
        .subscribe()
      return () => supabase.removeChannel(ch)
    })()
  }, [router])

  const load = async (userId) => {
    try {
      setLoading(true); setErr(''); // msg'i silmiyoruz
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, status, created_at, slot_id, user_id,
          slots (id, date, time, duration_minutes)
        `)
        .eq('user_id', userId)
      if (error) throw error

      const upcoming = (data||[])
        .map(b => ({ ...b, slot: b.slots }))
        .filter(b => b.slot && isFutureLocal(b.slot.date, b.slot.time) && b.status !== 'cancelled')
        .sort((a,b) => (a.slot.date+a.slot.time).localeCompare(b.slot.date+b.slot.time))

      setRows(upcoming)
    } catch (e) {
      showErr(e.message || String(e)); setRows([])
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async (bookingId, slot) => {
    if (busyCancelId === bookingId) return
    const ok = window.confirm(`${trLongDate(slot.date)} ${slot.time} randevusunu iptal etmek istiyor musunuz?`)
    if (!ok) return

    try {
      setBusyCancelId(bookingId)
      setErr(''); showMsg('Randevu iptal ediliyor…')

      // ✅ RPC: iptal + iade (tek transaction ve 24saat kontrolü)
      const { data, error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.message || 'İptal edilemedi')

      // Sunucudan gelen mesaja göre göster
      // Örn: data.refunded === true/false ve/veya data.message içinde “24 saatten az/çok” açıklaması
      if (data?.message) {
        showMsg(data.message)
      } else {
        showMsg(data?.refunded
          ? 'Randevu iptal edildi, 1 kredi iade edildi.'
          : 'Randevu iptal edildi (kredi iadesi yapılmadı).'
        )
      }

      // Listeyi tazele
      const { data:{ user } } = await supabase.auth.getUser()
      if (user?.id) await load(user.id)
    } catch (e) {
      showErr(e.message || String(e))
    } finally {
      setBusyCancelId(null)
    }
  }

  const statusBadge = (status) => {
    const map = {
      booked:    { text:'Randevu Oluşturuldu', color:'#1e7e34', bg:'#e7f6ec', border:'#bce3c7' },
      pending:   { text:'Onay bekliyor',       color:'#f39c12', bg:'#fff7e6', border:'#f39c12' },
      approved:  { text:'Onaylandı',           color:'#2e7d32', bg:'#eef9f1', border:'#2e7d32' },
      rejected:  { text:'Reddedildi',          color:'#c62828', bg:'#fdecea', border:'#c62828' },
      cancelled: { text:'İptal edildi',        color:'#9e9e9e', bg:'#f3f3f3', border:'#9e9e9e' },
    }
    const s = map[status] || { text: status, color:'#555', bg:'#eee', border:'#bbb' }
    return (
      <span style={{
        color:s.color, background:s.bg, border:`1px solid ${s.border}`,
        padding:'4px 8px', borderRadius:8, fontSize:12, fontWeight:700
      }}>
        {s.text}
      </span>
    )
  }

  if (loading) return <main style={{ padding:16 }}>Yükleniyor…</main>

  return (
    <main style={{ maxWidth:860, margin:'24px auto', padding:'0 16px', fontFamily:'Arial, sans-serif' }}>
      <h2 style={{ borderBottom:'2px solid #007b55', paddingBottom:6 }}>
        Randevularım
      </h2>

      {/* Dismissible mesaj kutuları */}
      {msg && (
        <div style={{ position:'relative', color:'#0a7', background:'#e9fbf6', border:'1px solid #b8efe3', padding:'10px 36px 10px 12px', borderRadius:8, marginTop:8 }}>
          {msg}
          <button
            onClick={() => setMsg('')}
            title="Kapat"
            style={{ position:'absolute', right:8, top:6, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}
          >
            ×
          </button>
        </div>
      )}
      {err && (
        <div style={{ position:'relative', color:'crimson', background:'#ffeaea', border:'1px solid #ffcccc', padding:'10px 36px 10px 12px', borderRadius:8, marginTop:8 }}>
          Hata: {err}
          <button
            onClick={() => setErr('')}
            title="Kapat"
            style={{ position:'absolute', right:8, top:6, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="scroll-vertical" style={{ maxHeight:'70vh', overflowY:'auto', paddingRight:8, marginTop: msg || err ? 8 : 0 }}>
        {rows.length === 0 ? (
          <p>Yaklaşan randevun bulunmuyor.</p>
        ) : (
          <ul style={{ listStyle:'none', padding:0, display:'grid', gap:12 }}>
            {rows.map(r => (
              <li key={r.id} style={{ border:'1px solid #e5e5e5', borderRadius:10, padding:14, background:'#fafafa' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div>
                    <b>{trLongDate(r.slot?.date)}</b> — {r.slot?.time} ({r.slot?.duration_minutes} dk)
                    <div style={{ fontSize:13, color:'#666' }}>
                      Oluşturma: {new Date(r.created_at).toLocaleString('tr-TR')}
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {statusBadge(r.status)}
                    {r.status === 'booked' && isFutureLocal(r.slot?.date, r.slot?.time) && (
                      <button
                        onClick={() => cancelBooking(r.id, r.slot)}
                        disabled={busyCancelId === r.id}
                        style={{
                          borderWidth:1, borderStyle:'solid', borderColor:'transparent',
                          background:'#e74c3c', color:'#fff',
                          padding:'8px 12px', borderRadius:8,
                          cursor: busyCancelId === r.id ? 'not-allowed' : 'pointer',
                          fontWeight:700, opacity: busyCancelId === r.id ? 0.6 : 1
                        }}
                      >
                        {busyCancelId === r.id ? 'İptal ediliyor…' : 'İptal Et'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
