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

/* Saatleri GÜNE göre üret */
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
          .insert({ id, date, time, duration_minutes: 60, status: willClose ? 'closed' : 'free' })
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

      const payload = hours.map(h => ({ id: `${date}T${h}`, date, time: h, duration_minutes: 60, status: close ? 'closed' : 'free' }))
      const { error } = await supabase.from('slots').upsert(payload, { onConflict: 'id' })
      if (error) throw error

      setMsg(close ? 'Tüm gün kapatıldı.' : 'Tüm gün açıldı.')
      await loadRange(days[0], days[days.length - 1])
      setTimeout(() => setMsg(''), 1400)
    } catch (e) {
      setErr(e.message || String(e))
    }
  }

  if (loading) return (
    <main className="loading">
      <div className="sk-title"/>
      <div className="sk-card"/>
      <div className="sk-card"/>
      <style jsx>{`
        .loading { padding: 16px; max-width: 900px; margin: 0 auto }
        .sk-title { height: 28px; width: 60%; border-radius: 8px; background: #eee; margin: 8px 0 16px }
        .sk-card { height: 110px; border-radius: 12px; background: #f2f2f2; margin: 8px 0 }
      `}</style>
    </main>
  )

  return (
    <div className="page">
      <header className="hdr">
        <div className="brand">Takvim Düzenleme</div>
        <div className="controls">
          <label className="dateLabel">
            <span>Gün Seç (ilerisi):</span>
            <input type="date" min={todayISO()} value={pickedDate} onChange={(e) => setPickedDate(e.target.value)} className="dateInput" />
          </label>
          {pickedDate && (
            <button onClick={() => setPickedDate('')} className="btn ghost">✕ Temizle (Önümüzdeki 30 gün)</button>
          )}
        </div>
      </header>

      {/* SCROLLABLE MAIN */}
      <main className="container" role="main">
        <h1 className="title">Takvim (Admin)</h1>

        <div className="legendRow">
          <Legend color="#2e7d32" label="Müsait" />
          <Legend color="#c62828" label="Rezerve" />
          <Legend color="#9e9e9e" label="Kapalı" />
        </div>

        {msg && <div className="ok">{msg}</div>}
        {err && <div className="err">Hata: {err}</div>}

        <section className="days">
          {days.map(date => {
            const hours = hoursFor(date)
            const allClosed = hours.length > 0 && hours.every(h => statusOf(date, h) === 'closed')
            return (
              <div key={date} className="dayCard">
                <div className="dayHead">
                  <div className="dayTitle">{trDate(date)}</div>
                  <label className="chkAll" style={{ opacity: hours.length ? 1 : 0.6 }}>
                    <input type="checkbox" disabled={hours.length === 0} checked={hours.length > 0 && allClosed} onChange={(e) => setWholeDay(date, e.target.checked)} />
                    <span>Tüm günü kapat</span>
                  </label>
                </div>

                {hours.length === 0 ? (
                  <div className="empty">Pazar: slot bulunmuyor.</div>
                ) : (
                  <div className="timeGrid">
                    {hours.map(h => {
                      const st = statusOf(date, h)
                      const cls = st === 'free' ? 'free' : st === 'reserved' ? 'reserved' : 'closed'
                      return (
                        <button key={h} onClick={() => toggleSlotClosed(date, h)} className={`slotBtn ${cls}`} title={`${trDate(date)} ${h} — ${nextHour(h)}`}>
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

      <style jsx>{`
        :root { --fg:#000; --bg:#fff; --br:#e5e5e5; --muted:#666; --primary:#007b55; --ok:#0a7 }
        .page { background: var(--bg); color: var(--fg); min-height: 100dvh; display:flex; flex-direction: column; font-family: Arial, sans-serif }
        .hdr { position: sticky; top: 0; z-index: 20; border-bottom:1px solid #e5e5e5; padding: 12px 16px; display:flex; align-items:center; justify-content: space-between; background: var(--bg) }
        .brand { font-size: 18px; font-weight: 700 }
        .controls { display:flex; align-items:center; gap: 8px; flex-wrap: wrap }
        .dateLabel { display:flex; align-items:center; gap: 8px; font-size: 14px }
        .dateInput { padding: 8px 10px; border:1px solid #ddd; border-radius: 10px; font-size: 14px }
        .btn { padding: 8px 12px; border-radius: 10px; border:1px solid #ddd; background:#eee; cursor:pointer; white-space: nowrap }
        .btn.ghost { background:#fff }

        .container { width: 100%; margin: 0 auto; padding: 16px; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch }
        .title { margin: 0 0 10px; color: var(--primary); text-align: center; font-size: 1.25rem }
        .legendRow { display:flex; align-items:center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px }
        .ok { color: var(--ok); margin: 8px 0 }
        .err { color: crimson; margin: 8px 0 }

        .days { display: grid; gap: 12px; margin-top: 8px }
        .dayCard { border:1px solid #cfcfcf; border-radius: 12px; padding: 12px; background:#fafafa }
        .dayHead { display:flex; justify-content: space-between; align-items:center; gap: 8px; margin-bottom: 8px }
        .dayTitle { font-weight: 700 }
        .chkAll { display:flex; align-items:center; gap: 6px; font-size: 14px }
        .empty { font-size: 13px; color:#777 }

        .timeGrid { display:grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) }
        .slotBtn { border-radius: 14px; padding: 12px 14px; font-weight: 600; font-size: 16px; line-height: 1.2; cursor:pointer; border:1px solid transparent; background:#fff; text-align:center; -webkit-tap-highlight-color: transparent }
        .slotBtn.free { border-color:#2e7d32; color:#2e7d32 }
        .slotBtn.closed { border-color:#9e9e9e; color:#9e9e9e; background:#f1f1f1 }
        .slotBtn.reserved { border-color:#c62828; color:#fff; background:#c62828 }

        /* ===== Mobil iyileştirmeler ===== */
        @media (max-width: 480px) {
          .hdr { padding: 10px 12px }
          .brand { font-size: 16px }
          .controls { width: 100% }
          .dateLabel { width: 100%; justify-content: space-between }
          .dateInput { width: 100%; font-size: 16px }
          .btn { width: 100%; font-size: 16px }

          .container { padding: 12px 12px 16px }
          .title { font-size: 1.1rem }
          .dayCard { padding: 12px }
          .dayHead { flex-direction: column; align-items: flex-start }
          .timeGrid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) }
          .slotBtn { padding: 12px; font-size: 15px }
        }

        /* Tablet */
        @media (min-width: 481px) and (max-width: 900px) {
          .timeGrid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) }
        }

        /* Desktop geniş */
        @media (min-width: 1200px) {
          .container { padding: 20px 32px }
          .timeGrid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) }
        }
      `}</style>
    </div>
  )
}

/* ====== Styles (JS objeleri sadece export için istenirse) ====== */
const Legend = ({ color, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <span style={{ width:14, height:14, background:color, borderRadius:4, display:'inline-block', opacity:0.9 }} />
    <span style={{ fontSize:13, color:'#444' }}>{label}</span>
  </div>
)
