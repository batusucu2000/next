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

const trShortDate = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const day = d.toLocaleDateString('tr-TR', { day: 'numeric' })
  const month = d.toLocaleDateString('tr-TR', { month: 'short' })
  const weekday = d.toLocaleDateString('tr-TR', { weekday: 'short' })
  return { day, month: month.toUpperCase(), weekday: weekday.toUpperCase() }
}

// Haftanın pazartesisi
const startOfWeekMon = (d) => {
  const x = new Date(d)
  const day = x.getDay() || 7 // Pazar=0 → 7
  if (day !== 1) x.setDate(x.getDate() - (day - 1))
  x.setHours(0,0,0,0)
  return x
}

// 09:00–20:00 (Hafta içi; Cumartesi 09:00–17:00; Pazar yok)
const hoursFor = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const dow = d.getDay() // 0: Pazar, 6: Cumartesi
  if (dow === 0) return []
  if (dow === 6) {
    const start = 9, end = 16
    const len = end - start + 1
    return Array.from({ length: len }, (_, i) => `${pad(start + i)}:00`)
  }
  const start = 9, end = 20
  const len = end - start + 1
  return Array.from({ length: len }, (_, i) => `${pad(start + i)}:00`)
}

// Tüm saatler (ızgara çizgileri için)
const ALL_HOURS = Array.from({ length: 12 }, (_, i) => `${pad(9 + i)}:00`)

// Yerel "şimdi"
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
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0,0,0,0)
    return t
  }, [])

  // BUGÜNÜN haftası
  const todayWeekStart = useMemo(() => startOfWeekMon(today), [today])

  // Görüntülenen haftanın başlangıcı (pazartesi)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeekMon(new Date()))

  // Sadece 1 hafta üret
  const weeks = useMemo(() => {
    const week = []
    const start = new Date(currentWeekStart)
    for (let d = 0; d < 7; d++) week.push(fmtDate(addDays(start, d)))
    return [week]
  }, [currentWeekStart])

  const allDays = useMemo(() => weeks[0], [weeks])

  const [loading, setLoading] = useState(true)
  const [credits, setCredits] = useState(0)
  const [slotsByDate, setSlotsByDate] = useState({})
  const [reserved, setReserved] = useState(new Set())
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

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

  const isSlotBooked = useCallback(async (slotId) => {
    const { data, error } = await supabase.rpc('get_reserved_slots', { slot_ids: [slotId] })
    if (error) return false
    return Array.isArray(data) && data.some(row => row.slot_id === slotId)
  }, [])

  const loadRange = useCallback(async (start, end) => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: me } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()
      setCredits(me?.credits ?? 0)

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

  // İlk yük + her hafta değişiminde aralığı getir
  useEffect(() => {
    if (!allDays?.length) return
    loadRange(allDays[0], allDays[allDays.length - 1])
  }, [allDays, loadRange])

  // Realtime
  useEffect(() => {
    const ch1 = supabase
      .channel('bookings-live-patient')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        if (allDays?.length) loadRange(allDays[0], allDays[allDays.length - 1])
      })
      .subscribe()
    const ch2 = supabase
      .channel('slots-live-patient')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
        if (allDays?.length) loadRange(allDays[0], allDays[allDays.length - 1])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [allDays, loadRange])

  // Slot durumu
  const statusOf = (date, hhmm) => {
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === hhmm)
    if (!slot) return 'closed'
    if (slot.status === 'closed') return 'closed'
    if (reserved.has(slot.id)) return 'reserved'
    if (isWithinLast12h(date, hhmm)) return 'closed'
    return 'free'
  }

  // Randevu al
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
        await loadRange(allDays[0], allDays[allDays.length - 1])
        return
      }

      if (error) {
        const reallyBooked = await isSlotBooked(slot.id)
        setBusy(false)
        if (reallyBooked) {
          showToast('success', 'Randevunuz oluşturuldu ✅')
          await loadRange(allDays[0], allDays[allDays.length - 1])
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

  /* ===== Navigasyon Sınırları (14 gün kuralı) =====
     - Geri: bugün haftasının gerisine geçme.
     - İleri: görüntülenen haftanın SON GÜNÜ <= (bugün + 13 gün) ise izin ver. */
  const canGoPrev = useMemo(() => {
    return currentWeekStart > todayWeekStart
  }, [currentWeekStart, todayWeekStart])

  const canGoNext = useMemo(() => {
    const weekEnd = addDays(currentWeekStart, 6) // pazartesi + 6
    const maxAllowed = addDays(today, 13)       // bugün + 13 (14 gün penceresi)
    return weekEnd < maxAllowed
  }, [currentWeekStart, today])

  const navigateWeeks = (direction) => {
    if (direction < 0 && !canGoPrev) return
    if (direction > 0 && !canGoNext) return
    setCurrentWeekStart(prev => addDays(prev, direction * 7))
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <div className="px-page">
      <header className="px-header">
        <div className="px-credits">Kalan kredi: <span>{credits}</span></div>
      </header>

      <main className="px-container">
        {/* Toast */}
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
          derse 12 saat kala yeni randevu alınamaz. En fazla 14 gün sonrasına rezervasyon yapılabilir.
          İptal ≥24 saat kala → kredi iade; &lt;24 saat kala → iade yok.
        </p>

        {/* Hafta Navigasyon (tek hafta) */}
        <div className="px-week-navigation">
          <button onClick={() => navigateWeeks(-1)} className="px-nav-btn" disabled={!canGoPrev}>← Önceki Hafta</button>
          <span className="px-week-range">
            {trDate(allDays[0])} - {trDate(allDays[allDays.length - 1])}
          </span>
          <button onClick={() => navigateWeeks(1)} className="px-nav-btn" disabled={!canGoNext}>Sonraki Hafta →</button>
        </div>

        {/* Takvim (tek hafta) */}
        <section className="px-calendar-view">
          <div className="px-calendar-grid">
            {/* Saatler sütunu */}
            <div className="px-time-column">
              <div className="px-time-header"></div>
              {ALL_HOURS.map(hour => (
                <div key={hour} className="px-time-label">{hour}</div>
              ))}
            </div>

            {/* Günler */}
            {allDays.map((date) => {
              const { day, month, weekday } = trShortDate(date)
              const isToday = date === fmtDate(today)
              const availableHours = hoursFor(date)

              return (
                <div key={date} className="px-day-column">
                  <div className={`px-day-header ${isToday ? 'px-today' : ''}`}>
                    <div className="px-weekday">{weekday}</div>
                    <div className="px-date">
                      <span className="px-day-number">{day}</span>
                      <span className="px-month">{month}</span>
                    </div>
                  </div>

                  <div className="px-day-slots">
                    {ALL_HOURS.map(hour => {
                      const isAvailable = availableHours.includes(hour)
                      const status = isAvailable ? statusOf(date, hour) : 'closed'

                      return (
                        <div
                          key={hour}
                          className={`px-calendar-slot px-slot-${status} ${isAvailable && status === 'free' ? 'px-clickable' : ''}`}
                          onClick={() => isAvailable && status === 'free' && book(date, hour)}
                          title={isAvailable ? `${trDate(date)} ${hour} — ${nextHour(hour)}` : 'Kapalı'}
                        >
                          {isAvailable && status === 'free' && (
                            <div className="px-slot-content">
                              <span className="px-slot-time">{hour}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <style jsx global>{`
        :root {
          --px-green: #2e7d32;
          --px-red: #c62828;
          --px-muted: #9e9e9e;
          --px-today: #1a73e8;
          --px-border: #dadce0;
          --px-hover: #f8f9fa;
          --px-disabled: #f5f5f5;
        }
        * { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; }

        .px-page {
          width: 100%;
          min-height: 100vh;
          background: #fff;
          color: #000;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        }
        .px-header {
          position: sticky; top: 0; z-index: 10;
          background: #fff; border-bottom: 1px solid var(--px-border);
          padding: 12px 20px; display: flex; align-items: center; justify-content: flex-end;
        }
        .px-credits { font-weight: 700; font-size: 14px; }
        .px-credits span { color: #007b55; }

        .px-container { padding: 20px; max-width: 1400px; margin: 0 auto; }

        .px-legend-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
        .px-rules { font-size: 14px; color: #555; line-height: 1.35; margin: 0 0 20px 0; }

        .px-week-navigation {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px; padding: 12px 0; border-bottom: 1px solid var(--px-border);
        }
        .px-nav-btn {
          background: #fff; border: 1px solid var(--px-border); border-radius: 6px;
          padding: 8px 16px; cursor: pointer; font-size: 14px; transition: all 0.2s;
        }
        .px-nav-btn:hover:not(:disabled) { background: var(--px-hover); }
        .px-nav-btn:disabled {
          background: var(--px-disabled); color: #999; cursor: not-allowed; border-color: #e0e0e0;
        }
        .px-week-range { font-weight: 600; color: #333; }

        .px-calendar-view { margin-bottom: 40px; }
        .px-calendar-grid {
          display: grid; grid-template-columns: 80px repeat(7, 1fr);
          border: 1px solid var(--px-border); border-radius: 8px; overflow: hidden;
        }
        .px-time-column { background: #f8f9fa; }
        .px-time-header { height: 60px; border-bottom: 1px solid var(--px-border); }
        .px-time-label {
          height: 60px; border-bottom: 1px solid var(--px-border);
          display: flex; align-items: flex-start; justify-content: flex-end; padding: 4px 8px;
          font-size: 12px; color: #666;
        }
        .px-day-column { border-right: 1px solid var(--px-border); }
        .px-day-column:last-child { border-right: none; }

        .px-day-header {
          height: 60px; border-bottom: 1px solid var(--px-border);
          display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8f9fa;
        }
        .px-day-header.px-today { background: var(--px-today); color: white; }
        .px-weekday { font-size: 12px; font-weight: 500; margin-bottom: 2px; }
        .px-date { display: flex; align-items: center; gap: 4px; }
        .px-day-number { font-size: 20px; font-weight: 400; }
        .px-month { font-size: 12px; font-weight: 500; }

        .px-day-slots { position: relative; }
        .px-calendar-slot {
          height: 60px; border-bottom: 1px solid var(--px-border); position: relative; transition: background-color 0.2s;
        }
        .px-calendar-slot:last-child { border-bottom: none; }
        .px-slot-free { background: #e8f5e8; }
        .px-slot-free:hover { background: #d4edda; }
        .px-slot-reserved { background: #f8d7da; }
        .px-slot-closed { background: #f8f9fa; }
        .px-clickable { cursor: pointer; }
        .px-slot-content { padding: 4px 8px; font-size: 12px; color: var(--px-green); font-weight: 500; }

        /* Toast */
        .px-toast-wrap {
          position: fixed; top: 14px; right: 14px; display: flex; flex-direction: column; gap: 10px;
          z-index: 9999; pointer-events: none;
        }
        .px-toast {
          pointer-events: auto; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
          min-width: 280px; max-width: min(92vw, 520px); padding: 12px; border: 1px solid; border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,.08); background: #fff; animation: px-toast-in .18s ease-out both;
        }
        @keyframes px-toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .px-toast-success { border-color: #c7f2df; background: #e9fbf6; }
        .px-toast-error { border-color: #ffd1d1; background: #ffecec; }
        .px-toast-info { border-color: #cfe3ff; background: #f1f6ff; }
        .px-toast-icon { width: 22px; height: 22px; display: grid; place-items: center; font-size: 18px; }
        .px-toast-text { font-size: 14px; color: #222; line-height: 1.35; white-space: pre-wrap; }
        .px-toast-close { border: none; background: transparent; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px 6px; color: #444; border-radius: 6px; }
        .px-toast-close:hover { background: rgba(0,0,0,.06); }
        .px-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(0,0,0,.15); border-top-color: rgba(0,0,0,.6); display: inline-block; }
        .px-spinner.spin { animation: px-spin 0.8s linear infinite; }
        @keyframes px-spin { to { transform: rotate(360deg); } }

        /* Responsive */
        @media (max-width: 768px) {
          .px-container { padding: 12px; }
          .px-calendar-grid { grid-template-columns: 60px repeat(7, 1fr); font-size: 12px; }
          .px-time-label { height: 50px; font-size: 10px; }
          .px-day-header { height: 50px; }
          .px-day-number { font-size: 16px; }
          .px-calendar-slot { height: 50px; }
        }

        @media (max-width: 480px) {
          .px-week-navigation { flex-direction: column; gap: 12px; }
        }
      `}</style>
    </div>
  )
}

/* Legend bileşeni */
const Legend = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{
      width: 14, height: 14, background: color, borderRadius: 4,
      display: 'inline-block', opacity: 0.9
    }} />
    <span style={{ fontSize: 13, color: '#444' }}>{label}</span>
  </div>
)
