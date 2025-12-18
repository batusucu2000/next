'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ===== Helpers ===== */
const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const nextHour = (hhmm) => `${pad(Number(hhmm.split(':')[0]) + 1)}:00`

const trDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return ''
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
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

/* Gün/Saat kuralları */
const hoursFor = (yyyyMMdd) => {
  const d = new Date(yyyyMMdd + 'T00:00:00')
  const dow = d.getDay() // 0: Pazar, 6: Cumartesi
  if (dow === 0) return [] // Pazar kapalı
  const start = 9
  const end = (dow === 6) ? 16 : 20
  const len = end - start + 1
  return Array.from({ length: len }, (_, i) => `${pad(start + i)}:00`)
}

const ALL_HOURS = Array.from({ length: 12 }, (_, i) => `${pad(9 + i)}:00`)

/* ===== Profiles için dayanıklı isim getirici ===== */
async function fetchProfilesWithBestName(userIds) {
  if (!userIds?.length) return {}
  const attempts = [
    { sel: 'id, full_name', map: (p) => p.full_name },
    { sel: 'id, name', map: (p) => p.name },
    { sel: 'id, display_name', map: (p) => p.display_name },
    { sel: 'id, first_name, last_name', map: (p) => [p.first_name, p.last_name].filter(Boolean).join(' ') },
  ]
  for (const a of attempts) {
    try {
      const { data, error } = await supabase.from('profiles').select(a.sel).in('id', userIds)
      if (error) throw error
      const out = {}
      for (const row of data || []) out[row.id] = a.map(row) || 'İsimsiz Hasta'
      if (Object.keys(out).length) return out
    } catch (e) {
      const msg = String(e?.message || e)
      if (!/column .* does not exist/i.test(msg)) throw e
    }
  }
  return userIds.reduce((acc, id) => (acc[id] = 'İsimsiz Hasta', acc), {})
}

export default function AdminCalendarPage() {
  const router = useRouter()

  // Haftanın başlangıcı ve "bugün" sadece client'ta belirlenir
  const [currentWeekStart, setCurrentWeekStart] = useState(null)
  const [today, setToday] = useState(null)

  // UI durumları
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Veriler
  const [slotsByDate, setSlotsByDate] = useState({})
  const [reservedDetails, setReservedDetails] = useState({})

  // Modal durumları
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [noteText, setNoteText] = useState('')

  // Notları localStorage'dan yükle
  const [slotNotes, setSlotNotes] = useState({})

  /* ==== Client'ta timezone güvenli başlangıç hesapla ==== */
  useEffect(() => {
    const now = new Date()
    // UTC midnight ile haftanın Pazartesi'sini bul (timezone farklarını elimine)
    const utcMidnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ))
    const mondayOffset = ((utcMidnight.getUTCDay() + 6) % 7) // Pazartesi=0
    utcMidnight.setUTCDate(utcMidnight.getUTCDate() - mondayOffset)
    setCurrentWeekStart(utcMidnight)
    setToday(fmtDate(new Date()))

    // localStorage'dan notları yükle
    const savedNotes = localStorage.getItem('adminSlotNotes')
    if (savedNotes) {
      setSlotNotes(JSON.parse(savedNotes))
    }
  }, [])

  /* ==== Görünecek hafta (tek hafta) ==== */
  const weeks = useMemo(() => {
    if (!currentWeekStart) return []
    const week = []
    for (let d = 0; d < 7; d++) week.push(fmtDate(addDays(currentWeekStart, d)))
    return [week]
  }, [currentWeekStart])

  const allDays = useMemo(() => weeks.flat(), [weeks])

  /* ==== Aralık yükleme ==== */
  const loadRange = useCallback(async (start, end) => {
    try {
      setLoading(true); setErr(''); setMsg('')

      // 1) slots
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

      // 2) booked detayları (hasta isimleri)
      if (allIds.length) {
        const { data: bookings, error: e2 } = await supabase
          .from('bookings')
          .select('slot_id, user_id, status')
          .in('slot_id', allIds)
          .eq('status', 'booked')
        if (e2) throw e2

        const userIds = [...new Set(bookings?.map(b => b.user_id).filter(Boolean))]
        const nameByUserId = await fetchProfilesWithBestName(userIds)

        const reservedMap = {}
        bookings?.forEach(b => { reservedMap[b.slot_id] = nameByUserId[b.user_id] || 'İsimsiz Hasta' })
        setReservedDetails(reservedMap)
      } else {
        setReservedDetails({})
      }
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  /* ==== Auth + ilk veri yükü ==== */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      if (!allDays.length) return
      await loadRange(allDays[0], allDays[allDays.length - 1])
    })()
  }, [router, allDays, loadRange])

  /* ==== Realtime ==== */
  useEffect(() => {
    if (!allDays.length) return
    const ch1 = supabase
      .channel('bookings-live-admin-cal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadRange(allDays[0], allDays[allDays.length - 1])
      })
      .subscribe()
    const ch2 = supabase
      .channel('slots-live-admin-cal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
        loadRange(allDays[0], allDays[allDays.length - 1])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [allDays, loadRange])

  /* ==== Yardımcılar ==== */
  const statusOf = (date, hhmm) => {
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === hhmm)
    if (!slot) return 'closed'
    if (slot.status === 'closed') return 'closed'
    if (reservedDetails[slot.id]) return 'reserved'
    return 'free'
  }

  const getPatientName = (date, hhmm) => {
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === hhmm)
    return slot ? reservedDetails[slot.id] : null
  }

  const getSlotId = (date, hhmm) => {
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === hhmm)
    return slot ? slot.id : `${date}T${hhmm}`
  }

  const getSlotNote = (date, hhmm) => {
    const slotId = getSlotId(date, hhmm)
    return slotNotes[slotId] || null
  }

  const saveSlotNote = (slotId, note) => {
    const updatedNotes = {
      ...slotNotes,
      [slotId]: note.trim()
    }
    setSlotNotes(updatedNotes)
    localStorage.setItem('adminSlotNotes', JSON.stringify(updatedNotes))
  }

  const removeSlotNote = (slotId) => {
    const updatedNotes = { ...slotNotes }
    delete updatedNotes[slotId]
    setSlotNotes(updatedNotes)
    localStorage.setItem('adminSlotNotes', JSON.stringify(updatedNotes))
  }

  /* ==== Not Modal'ını Aç ==== */
  const openNoteModal = (date, time) => {
    setSelectedSlot({ date, time })
    const slotId = getSlotId(date, time)
    setNoteText(slotNotes[slotId] || '')
    setShowNoteModal(true)
  }

  /* ==== Not Modal'ını Kapat ==== */
  const closeNoteModal = () => {
    setShowNoteModal(false)
    setSelectedSlot(null)
    setNoteText('')
  }

  /* ==== Notu Kaydet ==== */
  const saveNote = () => {
    if (!selectedSlot) return
    const slotId = getSlotId(selectedSlot.date, selectedSlot.time)
    
    if (noteText.trim()) {
      saveSlotNote(slotId, noteText)
    } else {
      removeSlotNote(slotId)
    }
    
    closeNoteModal()
  }

  /* ==== Slot Kapatma/Açma ==== */
  const toggleSlotClosed = async (date, time) => {
    try {
      setErr('')
      const cur = statusOf(date, time)
      const list = slotsByDate[date] || []
      const slot = list.find(s => s.time === time)
      const slotId = getSlotId(date, time)
      const hasNote = getSlotNote(date, time)

      const willClose = cur !== 'closed'
      
      // Önce not modal'ını aç
      openNoteModal(date, time)
      
      // Not modal'ı kapanınca işleme devam et
      // Not: Burada modal'ın kapanmasını bekleyeceğiz, modal içinde "İptal Et" butonu olacak
      
    } catch (e) {
      setErr(e.message || String(e))
    }
  }

  /* ==== Not Modal'dan İptal İşlemi ==== */
  const confirmSlotAction = async (withNote = false) => {
    if (!selectedSlot) return
    
    const { date, time } = selectedSlot
    const cur = statusOf(date, time)
    const list = slotsByDate[date] || []
    const slot = list.find(s => s.time === time)
    const slotId = getSlotId(date, time)
    const willClose = cur !== 'closed'
    const patientName = getPatientName(date, time)

    // Notu kaydet (eğer varsa)
    if (withNote && noteText.trim()) {
      saveSlotNote(slotId, noteText.trim())
    }

    const titleTxt = `${trDate(date)} ${time} — ${nextHour(time)}`
    let confirmText = willClose
      ? `${titleTxt}\nBu saati KAPATMAK istediğinize emin misiniz?`
      : `${titleTxt}\nBu saati AÇMAK istediğinize emin misiniz?`

    if (cur === 'reserved' && willClose) {
      confirmText += `\n\nDİKKAT: Bu saatte ${patientName || 'bir hastanın'} randevusu var.`
    }

    if (withNote && noteText.trim()) {
      confirmText += `\n\nNotunuz: "${noteText.trim()}"`
    }

    const ok = window.confirm(confirmText)
    if (!ok) {
      closeNoteModal()
      return
    }

    try {
      setMsg('Kaydediliyor…')

      if (!slot) {
        const { error } = await supabase
          .from('slots')
          .insert({ 
            id: slotId, 
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
      await loadRange(allDays[0], allDays[allDays.length - 1])
      setTimeout(() => setMsg(''), 1200)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      closeNoteModal()
    }
  }

  const setWholeDay = async (date, close = true) => {
    try {
      const hours = hoursFor(date)
      if (hours.length === 0) { setErr('Bu gün için kapatılacak saat aralığı yok (Pazar).'); return }

      const titleTxt = trDate(date)
      const confirmText = close
        ? `${titleTxt}\nTÜM günü KAPATMAK istediğinize emin misiniz?`
        : `${titleTxt}\nTÜM günü AÇMAK istediğinize emin misiniz?`
      if (!window.confirm(confirmText)) return

      setErr(''); setMsg('Günlük işlem uygulanıyor…')

      const payload = hours.map(h => ({ id: `${date}T${h}`, date, time: h, duration_minutes: 60, status: close ? 'closed' : 'free' }))
      const { error } = await supabase.from('slots').upsert(payload, { onConflict: 'id' })
      if (error) throw error

      setMsg(close ? 'Tüm gün kapatıldı.' : 'Tüm gün açıldı.')
      await loadRange(allDays[0], allDays[allDays.length - 1])
      setTimeout(() => setMsg(''), 1400)
    } catch (e) {
      setErr(e.message || String(e))
    }
  }

  /* ==== Loading ==== */
  if (loading || !currentWeekStart) {
    return (
      <main
        style={{ padding:16, maxWidth:900, margin:'0 auto' }}
        aria-busy="true"
      >
        <div style={{ height:28, width:'60%', borderRadius:8, background:'#eee', margin:'8px 0 16px' }} />
        <div style={{ height:110, borderRadius:12, background:'#f2f2f2', margin:'8px 0' }} />
        <div style={{ height:110, borderRadius:12, background:'#f2f2f2', margin:'8px 0' }} />
      </main>
    )
  }

  return (
    <div className="page" suppressHydrationWarning>
      <header className="hdr">
        <div className="brand">Takvim Düzenleme (Admin)</div>
        <div className="week-navigation">
          <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} className="nav-btn">← Önceki Hafta</button>
          <span className="week-range">{trDate(weeks[0][0])} - {trDate(weeks[0][6])}</span>
          <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} className="nav-btn">Sonraki Hafta →</button>
        </div>
      </header>

      <main className="container" role="main">
        <div className="legendRow">
          <Legend color="#2e7d32" label="Müsait" />
          <Legend color="#c62828" label="Rezerve" />
          <Legend color="#9e9e9e" label="Kapalı" />
          <Legend color="#ffb300" label="Not Var" />
        </div>

        {msg && <div className="ok">{msg}</div>}
        {err && <div className="err">Hata: {err}</div>}

        <section className="calendar-view">
          <div className="calendar-grid">
            {/* Sol saat kolonu */}
            <div className="time-column">
              <div className="time-header"></div>
              {ALL_HOURS.map(hour => (<div key={hour} className="time-label">{hour}</div>))}
            </div>

            {/* Gün kolonları */}
            {weeks[0].map((date) => {
              const { day, month, weekday } = trShortDate(date)
              const isToday = today ? (date === today) : false
              const hours = hoursFor(date)
              const allClosed = hours.length > 0 && hours.every(h => statusOf(date, h) === 'closed')

              return (
                <div key={date} className="day-column">
                  <div className={`day-header ${isToday ? 'today' : ''}`}>
                    <div className="weekday">{weekday}</div>
                    <div className="date">
                      <span className="day-number">{day}</span>
                      <span className="month">{month}</span>
                    </div>
                    <label className="day-checkbox">
                      <input
                        type="checkbox"
                        disabled={hours.length === 0}
                        checked={hours.length > 0 && allClosed}
                        onChange={(e) => setWholeDay(date, e.target.checked)}
                      />
                      <span>Tüm günü kapat</span>
                    </label>
                  </div>

                  <div className="day-slots">
                    {ALL_HOURS.map(hour => {
                      const availableHours = hoursFor(date)
                      const isAvailable = availableHours.includes(hour)
                      const status = isAvailable ? statusOf(date, hour) : 'closed'
                      const patientName = getPatientName(date, hour)
                      const slotNote = getSlotNote(date, hour)
                      const hasNote = !!slotNote

                      return (
                        <div
                          key={hour}
                          className={`calendar-slot slot-${status} ${hasNote ? 'has-note' : ''} ${isAvailable ? 'clickable' : ''}`}
                          onClick={() => isAvailable && toggleSlotClosed(date, hour)}
                          title={
                            isAvailable
                              ? (status === 'reserved'
                                  ? `${trDate(date)} ${hour} — ${nextHour(hour)}\nHasta: ${patientName}${hasNote ? `\n\nNot: ${slotNote}` : ''}`
                                  : `${trDate(date)} ${hour} — ${nextHour(hour)}${hasNote ? `\n\nNot: ${slotNote}` : ''}`)
                              : 'Kapalı'
                          }
                        >
                          {isAvailable && status === 'free' && (
                            <div className="slot-content">
                              <span className="slot-time">{hour}</span>
                              {hasNote && <span className="slot-note-icon" title={slotNote}>📝</span>}
                            </div>
                          )}
                          {isAvailable && status === 'reserved' && (
                            <div className="slot-content reserved">
                              <span className="slot-time">{hour}</span>
                              <span className="patient-name">{patientName}</span>
                              {hasNote && <span className="slot-note-icon" title={slotNote}>📝</span>}
                            </div>
                          )}
                          {isAvailable && status === 'closed' && (
                            <div className="slot-content closed">
                              <span className="slot-time">{hour}</span>
                              {hasNote && <span className="slot-note-icon" title={slotNote}>📝</span>}
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

      {/* Not Modal */}
      {showNoteModal && selectedSlot && (
        <div className="modal-overlay" onClick={closeNoteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Not Ekle</h3>
              <button className="modal-close" onClick={closeNoteModal} aria-label="Kapat">
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              <div className="slot-info">
                <p><strong>Tarih:</strong> {trDate(selectedSlot.date)}</p>
                <p><strong>Saat:</strong> {selectedSlot.time} - {nextHour(selectedSlot.time)}</p>
                {getPatientName(selectedSlot.date, selectedSlot.time) && (
                  <p className="warning">
                    <strong>Dikkat:</strong> Bu saatte {getPatientName(selectedSlot.date, selectedSlot.time)} isimli hastanın randevusu var!
                  </p>
                )}
              </div>
              
              <div className="note-section">
                <label htmlFor="noteInput">
                  <strong>Not (Örn: yaşlı hasta, özel durum, vb.):</strong>
                </label>
                <textarea
                  id="noteInput"
                  className="note-input"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Bu saat için notunuzu yazın..."
                  rows={4}
                  maxLength={200}
                  autoFocus
                />
                <div className="note-counter">
                  {noteText.length}/200 karakter
                </div>
              </div>
              
              <div className="info-box">
                <strong>Bilgi:</strong> Bu not sadece sizin görebileceğiniz şekilde bu saatte görünecektir.
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => {
                  if (window.confirm('Not eklemeden devam etmek istiyor musunuz?')) {
                    confirmSlotAction(false)
                  }
                }}
              >
                Not Eklemeyip Devam Et
              </button>
              <button
                className="btn-save"
                onClick={() => confirmSlotAction(true)}
              >
                Notu Kaydet ve Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :root { 
          --green:#2e7d32; 
          --red:#c62828; 
          --muted:#9e9e9e; 
          --border:#dadce0; 
          --hover:#f8f9fa; 
          --note-yellow:#ffb300;
        }
        .page { background:#fff; color:#000; min-height:100dvh; display:flex; flex-direction:column; font-family:system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
        .hdr { position:sticky; top:0; z-index:20; border-bottom:1px solid var(--border); padding:12px 20px; display:flex; align-items:center; justify-content:space-between; background:#fff; flex-wrap:wrap; gap:12px; }
        .brand { font-size:18px; font-weight:700; color:#007b55; }
        .week-navigation { display:flex; align-items:center; gap:16px; }
        .nav-btn { background:#fff; border:1px solid var(--border); border-radius:6px; padding:8px 12px; cursor:pointer; font-size:14px; transition:all .2s; }
        .nav-btn:hover { background:var(--hover); }
        .week-range { font-weight:600; color:#333; font-size:14px; }
        .container { padding:20px; max-width:1400px; margin:0 auto; flex:1; }
        .legendRow { display:flex; align-items:center; gap:14px; margin-bottom:16px; flex-wrap:wrap; }
        .ok { color:#0a7; margin:8px 0; font-weight:500; }
        .err { color:crimson; margin:8px 0; }

        .calendar-view { margin-bottom:40px; }
        .calendar-grid { display:grid; grid-template-columns:80px repeat(7, 1fr); border:1px solid var(--border); border-radius:8px; overflow:hidden; background:#fff; }
        .time-column { background:#f8f9fa; }
        .time-header { height:80px; border-bottom:1px solid var(--border); }
        .time-label { height:60px; border-bottom:1px solid var(--border); display:flex; align-items:flex-start; justify-content:flex-end; padding:4px 8px; font-size:12px; color:#666; font-weight:500; }
        .day-column { border-right:1px solid var(--border); }
        .day-column:last-child { border-right:none; }

        .day-header { height:80px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f8f9fa; padding:8px; text-align:center; position:relative; }
        .day-header.today { background:#1a73e8; color:#fff; border-bottom:1px solid #1a73e8; }
        .weekday { font-size:12px; font-weight:500; margin-bottom:2px; }
        .date { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
        .day-number { font-size:20px; font-weight:400; }
        .month { font-size:12px; font-weight:500; }

        .day-checkbox { display:flex; align-items:center; gap:4px; font-size:11px; position:absolute; bottom:4px; }
        .day-checkbox input { margin:0; }

        .day-slots { position:relative; }
        .calendar-slot { height:60px; border-bottom:1px solid var(--border); position:relative; transition:background-color .2s; padding:4px; }
        .calendar-slot:last-child { border-bottom:none; }
        .slot-free { background:#e8f5e8; }
        .slot-free:hover { background:#d4edda; }
        .slot-reserved { background:#f8d7da; }
        .slot-reserved:hover { background:#f1b8be; }
        .slot-closed { background:#f8f9fa; }
        .slot-closed:hover { background:#e9ecef; }
        .clickable { cursor:pointer; }
        .has-note { border-left:3px solid var(--note-yellow) !important; }

        .slot-content { padding:2px 4px; font-size:11px; color:var(--green); font-weight:500; height:100%; display:flex; flex-direction:column; justify-content:center; position:relative; }
        .slot-content.reserved { color:var(--red); }
        .slot-content.closed { color:var(--muted); }
        .patient-name { font-size:10px; font-weight:600; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .slot-note-icon { position:absolute; top:2px; right:2px; font-size:10px; cursor:help; }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #333;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #666;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }

        .modal-close:hover {
          background: #f5f5f5;
          color: #333;
        }

        .modal-body {
          padding: 20px 24px;
        }

        .slot-info {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .slot-info p {
          margin: 8px 0;
          color: #555;
        }

        .slot-info .warning {
          color: #d32f2f;
          background: #ffebee;
          padding: 8px;
          border-radius: 4px;
          border-left: 3px solid #d32f2f;
        }

        .note-section {
          margin-bottom: 20px;
        }

        .note-section label {
          display: block;
          margin-bottom: 8px;
          color: #333;
        }

        .note-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.95rem;
          resize: vertical;
          transition: border 0.2s;
        }

        .note-input:focus {
          outline: none;
          border-color: #007b55;
          box-shadow: 0 0 0 2px rgba(0, 123, 85, 0.1);
        }

        .note-counter {
          text-align: right;
          font-size: 0.85rem;
          color: #666;
          margin-top: 4px;
        }

        .info-box {
          background: #e3f2fd;
          border: 1px solid #2196f3;
          border-radius: 8px;
          padding: 12px;
          color: #0d47a1;
          font-size: 0.9rem;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          background: #f8f9fa;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        .btn-cancel {
          flex: 1;
          padding: 12px;
          border: 1px solid #ccc;
          background: white;
          color: #333;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-cancel:hover {
          background: #f5f5f5;
          border-color: #999;
        }

        .btn-save {
          flex: 1;
          padding: 12px;
          border: 1px solid #007b55;
          background: #007b55;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-save:hover {
          background: #006747;
          border-color: #006747;
        }

        @media (max-width: 768px) {
          .hdr { flex-direction:column; align-items:flex-start; }
          .week-navigation { width:100%; justify-content:space-between; }
          .container { padding:12px; }
          .calendar-grid { grid-template-columns:60px repeat(7, 1fr); font-size:12px; }
          .time-label { height:50px; font-size:10px; }
          .day-header { height:70px; padding:4px; }
          .day-number { font-size:16px; }
          .calendar-slot { height:50px; }
          .slot-note-icon { font-size:9px; top:1px; right:1px; }
          .modal-footer { flex-direction: column; }
        }
        @media (max-width: 480px) {
          .nav-btn { padding:6px 8px; font-size:12px; }
          .week-range { font-size:12px; }
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
