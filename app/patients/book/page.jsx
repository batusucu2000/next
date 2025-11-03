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

// 09:00–20:00 (Hafta içi & Pazar hariç varsayılan), Cumartesi 09:00–17:00
const hoursFor = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const dow = d.getDay() // 0: Pazar, 6: Cumartesi
  if (dow === 6) {
    const start = 9, end = 16
    const len = end - start + 1
    return Array.from({ length: len }, (_, i) => `${pad(start + i)}:00`)
  }
  const start = 9, end = 20
  const len = end - start + 1
  return Array.from({ length: len }, (_, i) => `${pad(start + i)}:00`)
}

// Yerel “şimdi”
const nowTR = () => new Date()

// "YYYY-MM-DD" + "HH:MM" → randevu başlangıcına 12 saatten az kaldı mı?
const isWithinLast12h = (yyyyMMdd, hhmm) => {
  try {
    const [y,m,d] = yyyyMMdd.split('-').map(Number)
    const [H,Min] = hhmm.split(':').map(Number)
    const slot = new Date(y,(m||1)-1,d||1,H||0,Min||0,0)
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
  const [credits, setCredits] = useState(0)

  // { [date]: Slot[] }, reserved: pending/approved/booked dolular
  const [slotsByDate, setSlotsByDate] = useState({})
  const [reserved, setReserved] = useState(new Set())

  // Toast + spinner
  const [notice, setNotice] = useState({ type: '', text: '' }) // 'info' | 'success' | 'error'
  const [busy, setBusy] = useState(false)

  // Mesaj zamanlayıcı
  const MESSAGE_TTL_MS = 5000
  const msgTimerRef = useRef(null)
  const clearMsgTimer = () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current) }
  const showToast = useCallback((type, text, ttl = MESSAGE_TTL_MS) => {
    setNotice({ type, text })
    clearMsgTimer()
    msgTimerRef.current = setTimeout(() => setNotice({ type:'', text:'' }), ttl)
  }, [])
  const closeToast = () => { clearMsgTimer(); setNotice({ type:'', text:'' }) }
  useEffect(() => () => clearMsgTimer(), [])

  // Tek slot dolu mu? — RPC ile kontrol (RLS güvenli)
  const isSlotBooked = useCallback(async (slotId) => {
    const { data, error } = await supabase.rpc('get_reserved_slots', { slot_ids: [slotId] })
    if (error) return false
    return Array.isArray(data) && data.some(row => row.slot_id === slotId)
  }, [])

  const loadRange = useCallback(async (start, end) => {
    try {
      setLoading(true)

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
      showToast('error', e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [router, showToast])

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
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
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
      if (!slot) { showToast('error', 'Bu saat kapalı.'); return }

      const note =
        'NOT: Derse geç kalınması durumunda gecikme süresi ders süresinden düşer.\n\n' +
        `${trDate(date)} ${hhmm} saatine randevu oluşturmak istediğinize emin misiniz?`
      if (!window.confirm(note)) return

      setBusy(true)
      showToast('info', `${trDate(date)} ${hhmm} için randevu oluşturuluyor…`, 7000)

      const { data, error } = await supabase.rpc('book_slot', { p_slot_id: slot.id })

      if (data?.ok) {
        setBusy(false)
        showToast('success', 'Randevunuz oluşturuldu ✅')
        await loadRange(days[0], days[days.length-1])
        return
      }

      if (error) {
        const reallyBooked = await isSlotBooked(slot.id)
        setBusy(false)
        if (reallyBooked) {
          showToast('success', 'Randevunuz oluşturuldu ✅')
          await loadRange(days[0], days[days.length-1])
          return
        }
        showToast('error', error.message || 'Randevu alınamadı')
        return
      }

      setBusy(false)
      showToast('error', data?.message || 'Randevu alınamadı')
    } catch (e) {
      setBusy(false)
      showToast('error', e.message || String(e))
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <div className="px-page">
      <header className="px-header">
        <div className="px-credits">Kalan kredi: <span>{credits}</span></div>
      </header>

      <main className="px-container">
        {/* Toast Stack */}
        <div className="px-toast-wrap" aria-live={notice.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          {notice.text && (
            <div className={`px-toast px-toast-${notice.type}`}>
              <div className="px-toast-icon">
                {notice.type === 'success' && '✅'}
                {notice.type === 'error' && '⛔'}
                {notice.type === 'info' && (<span className={`px-spinner ${busy ? 'spin' : ''}`} aria-hidden="true"></span>)}
              </div>
              <div className="px-toast-text">{notice.text}</div>
              <button className="px-toast-close" onClick={closeToast} aria-label="Kapat">×</button>
            </div>
          )}
        </div>

        <div className="px-legend-row">
          <Legend color="#2e7d32" label="Müsait" />
          <Legend color="#c62828" label="Dolu" />
          <Legend color="#9e9e9e" label="Kapalı" />
        </div>

        <p className="px-rules">
          Kurallar: Aynı güne 1 ders, aynı haftaya en fazla 3 ders. Randevular hafta içi 09:00–20:00 arasında,
          derse 12 saat kala yeni randevu alınamaz. En fazla 15 gün sonrasına rezervasyon yapılabilir.
          İptal ≥24 saat kala → kredi iade; &lt;24 saat kala → iade yok.
        </p>

        {/* SCROLLABLE ALAN */}
        <section className="px-days-scroll">
          <div className="px-days-grid">
            {days.map(date => (
              <div key={date} className="px-day-card">
                <div className="px-day-title">{trDate(date)}</div>
                <div className="px-time-grid">
                  {hoursFor(date).map(h => {
                    const st = statusOf(date, h)
                    const cls =
                      st === 'free'     ? 'px-time-btn px-time-free' :
                      st === 'reserved' ? 'px-time-btn px-time-reserved' :
                                          'px-time-btn px-time-closed'
                    return (
                      <button
                        key={h}
                        disabled={st !== 'free'}
                        onClick={() => book(date, h)}
                        className={cls}
                        title={`${trDate(date)} ${h} — ${nextHour(h)}`}
                      >
                        <span className="px-slot-hour">{h}</span>
                        <span className="px-slot-dash"> — </span>
                        <span className="px-slot-hour">{nextHour(h)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ---- Styles ---- */}
      <style jsx global>{`
        :root{
          --slots-max-h: 60dvh;
          --slots-max-w: 1580px;          /* Slot alanı azami genişlik (sola hizalı) */
          --slot-min: 420px;              /* Slot butonu min genişlik */
          --px-green:#2e7d32; --px-red:#c62828; --px-muted:#666;
          --safe-bottom: env(safe-area-inset-bottom, 16px);
        }

        *,*::before,*::after{ box-sizing:border-box }
        html,body{ height:100% }
        body{ margin:0; overflow:hidden }

        .px-page{
          width:100%;                     /* 200% KALDIRILDI */
          height:100dvh;
          display:flex; flex-direction:column; min-height:0;
          background:#fff; color:#000;
          font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
        }

        .px-header{
          position:sticky; top:0; z-index:10; background:#fff;
          border-bottom:1px solid #e5e5e5;
          padding:12px 20px 12px 0;       /* Sol padding 0, tamamen sola */
          display:flex; align-items:center; justify-content:flex-end;
          flex:0 0 auto;
        }
        .px-credits{ font-weight:700; font-size:14px }
        .px-credits span{ color:#007b55 }

        .px-container{
          max-width:none;
          width:100%;
          margin:10px 0 12px 0;
          padding:0 20px 0 0;             /* Sol 0: en soldan başlar */
          display:flex; flex-direction:column; gap:8px;
          flex:1 1 auto; min-height:0;
          overflow:hidden; overflow-x:hidden;
        }

        .px-legend-row{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; flex:0 0 auto }
        .px-rules{ font-size:14px; color:#555; line-height:1.35; margin:0; flex:0 0 auto }

        .px-days-scroll{
          flex:0 0 auto;
          width:100%;
          max-width: var(--slots-max-w);
          margin-left: 0;                  /* SOLA YAPIŞ */
          margin-right: auto;              /* sağa doğru boşluk */
          max-height: var(--slots-max-h);
          overflow:auto; overflow-x:hidden;
          border:1px solid #eee; border-radius:12px;
          padding:12px; padding-bottom:calc(12px + var(--safe-bottom));
          background:#fff; -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain; scrollbar-gutter:stable both-edges;
        }

        .px-days-grid{ display:grid; gap:16px; grid-template-columns: 1fr; }
        .px-day-card{ border:1px solid #cfcfcf; border-radius:12px; padding:16px; background:#fafafa }
        .px-day-title{ font-weight:700; margin-bottom:10px; font-size:15px }

        .px-time-grid{
          display:grid; gap:12px;
          grid-template-columns: repeat(auto-fit, minmax(var(--slot-min), 1fr));
        }
        .px-time-btn{
          border-radius:12px; padding:14px; min-height:48px; font-weight:700; font-size:16px;
          border:1px solid transparent; background:#fff; display:flex; align-items:center; justify-content:center;
          user-select:none; -webkit-tap-highlight-color:transparent; cursor:pointer;
        }
        .px-time-free{ border-color:var(--px-green); color:var(--px-green) }
        .px-time-closed{ border-color:#9e9e9e; color:#9e9e9e; cursor:not-allowed; background:#f1f1f1 }
        .px-time-reserved{ border-color:var(--px-red); color:#fff; background: var(--px-red); cursor:not-allowed }
        .px-time-free:active{ transform:scale(0.98) }
        .px-slot-hour{ font-variant-numeric: tabular-nums }
        .px-slot-dash{ opacity:.8 }

        /* ===== Toast ===== */
        .px-toast-wrap{
          position: fixed;
          top: 14px;
          right: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 9999;
          pointer-events: none;
        }
        .px-toast{
          pointer-events: auto;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 10px;
          min-width: 280px;
          max-width: min(92vw, 520px);
          padding: 12px 12px;
          border: 1px solid;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,.08);
          background: #fff;
          animation: px-toast-in .18s ease-out both;
        }
        @keyframes px-toast-in{
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .px-toast-success{ border-color:#c7f2df; background:#e9fbf6; }
        .px-toast-error  { border-color:#ffd1d1; background:#ffecec; }
        .px-toast-info   { border-color:#cfe3ff; background:#f1f6ff; }

        .px-toast-icon{
          width: 22px; height: 22px;
          display: grid; place-items: center;
          font-size: 18px;
        }
        .px-toast-text{
          font-size: 14px;
          color: #222;
          line-height: 1.35;
          white-space: pre-wrap;
        }
        .px-toast-close{
          border: none; background: transparent; cursor: pointer;
          font-size: 18px; line-height: 1; padding: 4px 6px; color:#444;
          border-radius: 6px;
        }
        .px-toast-close:hover{ background: rgba(0,0,0,.06); }

        .px-spinner{
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(0,0,0,.15);
          border-top-color: rgba(0,0,0,.6);
          display: inline-block;
        }
        .px-spinner.spin{ animation: px-spin 0.8s linear infinite; }
        @keyframes px-spin{ to { transform: rotate(360deg); } }

        /* Mobil */
        @media (max-width: 479px){
          .px-credits{ font-size:13px }
          .px-day-card{ padding:12px }
          .px-day-title{ font-size:13px }
          .px-time-grid{ grid-template-columns: 1fr; }
          .px-time-btn{ font-size:15px; min-height:48px }
        }
      `}</style>
    </div>
  )
}

/* Legend bileşeni */
const Legend = ({ color, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <span style={{ width:14, height:14, background:color, borderRadius:4, display:'inline-block', opacity:0.9 }} />
    <span style={{ fontSize:13, color:'#444' }}>{label}</span>
  </div>
)
