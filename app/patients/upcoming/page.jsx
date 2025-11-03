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
  const showMsg = (text) => { setMsg(text); startMsgTimer() }
  const showErr = (text) => { setErr(text) }
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
      setLoading(true); setErr('')
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

      if (data?.message) {
        showMsg(data.message)
      } else {
        showMsg(data?.refunded
          ? 'Randevu iptal edildi, 1 kredi iade edildi.'
          : 'Randevu iptal edildi (kredi iadesi yapılmadı).'
        )
      }

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
      <span className="up-badge" style={{ color:s.color, background:s.bg, borderColor:s.border }}>
        {s.text}
      </span>
    )
  }

  if (loading) return <main className="up-wrap" style={{ padding:16 }}>Yükleniyor…</main>

  return (
    <main className="up-wrap">
      <h2 className="up-title">Randevularım</h2>

      {/* Dismissible mesaj kutuları */}
      {msg && (
        <div className="up-alert up-alert-ok" role="status" aria-live="polite">
          {msg}
          <button onClick={() => setMsg('')} title="Kapat" className="up-alert-close">×</button>
        </div>
      )}
      {err && (
        <div className="up-alert up-alert-err" role="alert" aria-live="assertive">
          Hata: {err}
          <button onClick={() => setErr('')} title="Kapat" className="up-alert-close">×</button>
        </div>
      )}

      <div className="up-scroll" style={{ marginTop: msg || err ? 8 : 0 }}>
        {rows.length === 0 ? (
          <p className="up-empty">Yaklaşan randevun bulunmuyor.</p>
        ) : (
          <ul className="up-list">
            {rows.map(r => (
              <li key={r.id} className="up-card">
                <div className="up-rowtop">
                  <div className="up-when">
                    <b>{trLongDate(r.slot?.date)}</b> — {r.slot?.time} ({r.slot?.duration_minutes} dk)
                    <div className="up-created">
                      Oluşturma: {new Date(r.created_at).toLocaleString('tr-TR')}
                    </div>
                  </div>

                  <div className="up-actions">
                    {statusBadge(r.status)}
                    {r.status === 'booked' && isFutureLocal(r.slot?.date, r.slot?.time) && (
                      <button
                        onClick={() => cancelBooking(r.id, r.slot)}
                        disabled={busyCancelId === r.id}
                        className={`up-btn up-btn-danger ${busyCancelId === r.id ? 'up-btn-disabled' : ''}`}
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

      {/* ===== Responsive Styles ===== */}
      <style jsx global>{`
        :root {
          --up-green: #007b55;
          --up-border: #e5e5e5;
          --up-muted: #666;
        }

        .up-wrap {
          max-width: 860px;
          margin: 16px auto;
          padding: 0 12px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          color: #111;
          background: #fff;
        }

        .up-title {
          border-bottom: 2px solid var(--up-green);
          padding-bottom: 6px;
          margin: 0 0 12px 0;
          font-size: 20px;
          line-height: 1.2;
          text-wrap: balance;
        }

        .up-alert {
          position: relative;
          border-radius: 10px;
          margin-top: 8px;
          padding: 12px 40px 12px 12px;
          border: 1px solid transparent;
          font-size: 14px;
        }
        .up-alert-ok  { color:#0a7; background:#e9fbf6; border-color:#b8efe3; }
        .up-alert-err { color:crimson; background:#ffeaea; border-color:#ffcccc; }
        .up-alert-close {
          position:absolute; right:10px; top:8px;
          border:none; background:transparent; cursor:pointer;
          font-size:20px; line-height:1; -webkit-tap-highlight-color:transparent;
        }

        .up-empty { color:#444; font-size:15px; padding:6px 0; }

        .up-scroll {
          max-height: 70vh;
          overflow-y: auto;
          padding-right: 6px;
          -webkit-overflow-scrolling: touch; /* iOS pürüzsüz scroll */
        }

        .up-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 12px;
        }

        .up-card {
          border: 1px solid var(--up-border);
          border-radius: 12px;
          padding: 14px;
          background: #fafafa;
        }

        .up-rowtop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .up-when { font-size: 16px; line-height: 1.4; }
        .up-created { font-size: 13px; color: var(--up-muted); margin-top: 4px; }

        .up-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          justify-content: flex-end;
        }

        .up-badge {
          border: 1px solid;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .up-btn {
          border-radius: 10px;
          border: 1px solid transparent;
          padding: 12px 14px;
          min-height: 44px;            /* dokunma alanı */
          font-weight: 800;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        .up-btn-danger {
          background: #e74c3c;
          color: #fff;
          border-color: #e74c3c;
        }
        .up-btn-disabled,
        .up-btn[disabled] { opacity: .6; cursor: not-allowed; }

        /* ===== Breakpoints ===== */
        /* < 480px: tek sütun, tam genişlik butonlar */
        @media (max-width: 479px) {
          .up-title { font-size: 18px; }
          .up-card { padding: 12px; }
          .up-when { font-size: 15px; }
          .up-badge { font-size: 12px; }
          .up-actions { gap: 8px; }
          .up-btn { width: 100%; }     /* iptal butonu tam genişlik */
          .up-scroll { max-height: 65vh; }
        }

        /* 480–767px: biraz daha ferah */
        @media (min-width: 480px) and (max-width: 767px) {
          .up-btn { min-width: 160px; }
        }

        /* >=768px: masaüstü */
        @media (min-width: 768px) {
          .up-title { font-size: 22px; }
          .up-card { padding: 16px; }
          .up-when { font-size: 17px; }
        }
      `}</style>
    </main>
  )
}
