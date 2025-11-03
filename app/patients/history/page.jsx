'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ===== Helpers ===== */
const pad = (n) => String(n).padStart(2, '0')
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
const nowHHMM = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const addDaysISO = (yyyyMMdd, n) => {
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  dt.setDate(dt.getDate()+n)
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`
}
const isPast = (date, time, todayStr, nowStr) =>
  date < todayStr || (date === todayStr && (time || '00:00') <= nowStr)

// YYYY-MM-DD → "24 Ekim 2025 Cuma"
const trLongDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return ''
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s
  const day = dt.toLocaleDateString('tr-TR',{day:'2-digit'})
  const month = cap(dt.toLocaleDateString('tr-TR',{month:'long'}))
  const year = dt.getFullYear()
  const weekday = cap(dt.toLocaleDateString('tr-TR',{weekday:'long'}))
  return `${day} ${month} ${year} ${weekday}`
}

/* ===== Pagination ===== */
const PAGE_SIZE = 8

export default function HistoryPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [page, setPage] = useState(1)
  const [pickedDate, setPickedDate] = useState('') // takvim seçimi

  const today = useMemo(() => todayLocal(), [])
  const now   = useMemo(() => nowHHMM(), [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      // Kullanıcının tüm bookings kayıtları
      const { data: bookings, error: e1 } = await supabase
        .from('bookings')
        .select('id, status, slot_id')
        .eq('user_id', user.id)
      if (e1) throw e1

      if (!bookings?.length) { setRows([]); setLoading(false); return }

      // İlgili slotlar
      const slotIds = bookings.map(b => b.slot_id).filter(Boolean)
      const { data: slots, error: e2 } = await supabase
        .from('slots')
        .select('id, date, time, duration_minutes')
        .in('id', slotIds)
      if (e2) throw e2

      const map = new Map(slots.map(s => [s.id, s]))
      setRows(bookings.map(b => ({ ...b, slot: map.get(b.slot_id) })))
      setPage(1)
      setLoading(false)
    })().catch(e => { setErr(e.message || String(e)); setLoading(false) })
  }, [router])

  /* --- Filtreleme: GEÇMİŞTE kalan tüm durumlar (approved/cancelled/rejected) --- */
  const last30Start = addDaysISO(today, -30)
  const filtered = rows
    .filter(x =>
      x.slot &&
      ['approved', 'cancelled', 'rejected'].includes(x.status) &&
      isPast(x.slot.date, x.slot.time, today, now)
    )
    .filter(x => pickedDate
      ? (x.slot.date === pickedDate)
      : (x.slot.date >= last30Start && x.slot.date <= today)
    )
    .sort((a,b) => (
      b.slot.date.localeCompare(a.slot.date) ||
      (b.slot.time || '').localeCompare(a.slot.time || '')
    ))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const startIdx = (page - 1) * PAGE_SIZE
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE)

  const badgeStyle = (status) => {
    if (status === 'approved') {
      return { text: 'Randevu gerçekleşti', color:'#1e7e34', bg:'#e7f6ec', border:'#bce3c7' }
    }
    if (status === 'cancelled') {
      return { text: 'İptal Edildi', color:'#c62828', bg:'#fde7e7', border:'#f5b7b7' }
    }
    if (status === 'rejected') {
      return { text: 'Reddedildi', color:'#e74c3c', bg:'#fdecea', border:'#f5b7b7' }
    }
    return { text: status, color:'#555', bg:'#eee', border:'#bbb' }
  }

  if (loading) return <main className="hx-wrap" style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main className="hx-wrap">
      <h2 className="hx-title">Geçmiş Randevularım</h2>
      {err && <div className="hx-err">Hata: {err}</div>}

      {/* Filtre satırı */}
      <div className="hx-filter">
        <label className="hx-filter-label">
          Eski bir gün seç:
          <input
            type="date"
            max={today}
            value={pickedDate}
            onChange={(e) => { setPickedDate(e.target.value); setPage(1) }}
            className="hx-date"
          />
        </label>
        {pickedDate && (
          <button
            onClick={() => { setPickedDate(''); setPage(1) }}
            className="hx-clear"
            title="Son 30 güne dön"
          >
            ✕ Temizle (Son 30 gün)
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="hx-empty">
          {pickedDate
            ? `${trLongDate(pickedDate)} için geçmiş randevu yok.`
            : 'Son 30 gün içinde geçmiş randevun bulunmuyor.'}
        </p>
      ) : (
        <>
          <div className="hx-scroll">
            <ul className="hx-list">
              {pageRows.map(r => {
                const st = badgeStyle(r.status)
                return (
                  <li key={r.id} className="hx-card">
                    <div className="hx-rowtop">
                      <div className="hx-datetext">
                        <b>{trLongDate(r.slot?.date)}</b> &nbsp; {r.slot?.time}
                        <span className="hx-dot">•</span>
                        <span className="hx-muted">{r.slot?.duration_minutes} dk</span>
                      </div>
                      <span
                        className="hx-badge"
                        style={{
                          borderColor: st.border,
                          color: st.color,
                          background: st.bg
                        }}
                      >
                        {st.text}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <Pagination page={page} total={totalPages} onChange={setPage} />
        </>
      )}

      {/* ===== Responsive Styles ===== */}
      <style jsx global>{`
        :root {
          --hx-green: #007b55;
          --hx-muted: #666;
          --hx-border: #e5e5e5;
        }

        .hx-wrap {
          max-width: 860px;
          margin: 16px auto;
          padding: 0 12px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          color: #111;
          background: #fff;
        }

        .hx-title {
          border-bottom: 2px solid var(--hx-green);
          padding-bottom: 6px;
          margin: 0 0 12px 0;
          font-size: 20px;
          line-height: 1.2;
          text-wrap: balance;
        }

        .hx-err { color: crimson; margin-top: 8px; }

        /* Filtre satırı sticky ve mobilde tam genişlik */
        .hx-filter {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 10px 0;
          background: #fff;
        }
        .hx-filter-label { font-size: 14px; color: #333; display: flex; align-items: center; gap: 8px; }
        .hx-date {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 10px;
          min-height: 44px; /* dokunma alanı */
          font-size: 15px;
        }
        .hx-clear {
          background: #f4f4f4;
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 10px 12px;
          min-height: 44px;
          cursor: pointer;
          font-weight: 600;
        }

        .hx-empty { color: #444; font-size: 15px; }

        /* Liste alanı */
        .hx-scroll {
          max-height: 65vh;
          overflow-y: auto;
          padding-right: 6px;
          -webkit-overflow-scrolling: touch;
        }
        .hx-list {
          list-style: none;
          padding: 0;
          display: grid;
          gap: 12px;
          margin: 0;
        }
        .hx-card {
          border: 1px solid var(--hx-border);
          border-radius: 14px;
          padding: 14px;
          background: #fafafa;
        }
        .hx-rowtop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .hx-datetext { font-size: 16px; line-height: 1.4; }
        .hx-dot { margin: 0 8px; color: #aaa; }
        .hx-muted { font-size: 13px; color: var(--hx-muted); }

        .hx-badge {
          border: 1px solid;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        /* Pagination */
        .hx-pager {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: 12px 0 4px;
          flex-wrap: wrap;
        }
        .hx-pbtn {
          min-width: 42px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid #ddd;
          background: #fff;
          cursor: pointer;
          font-weight: 700;
          font-size: 15px;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        .hx-pbtn[disabled] { opacity: 0.5; cursor: not-allowed; }
        .hx-pbtn--active { background: var(--hx-green); color: #fff; border-color: var(--hx-green); }

        /* ===== Breakpoints ===== */
        /* < 480px: tek sütun, daha büyük kontroller */
        @media (max-width: 479px) {
          .hx-title { font-size: 18px; }
          .hx-date { width: 100%; }
          .hx-filter { gap: 8px; }
          .hx-clear { width: 100%; text-align: center; }
          .hx-card { padding: 12px; }
          .hx-datetext { font-size: 15px; }
          .hx-badge { font-size: 12px; padding: 6px 10px; }
          .hx-scroll { max-height: 62vh; }
        }

        /* 480–767px: daha ferah */
        @media (min-width: 480px) and (max-width: 767px) {
          .hx-datetext { font-size: 16px; }
        }

        /* >= 768px: masaüstü dokunuşları */
        @media (min-width: 768px) {
          .hx-title { font-size: 22px; }
          .hx-card { padding: 16px; }
          .hx-datetext { font-size: 17px; }
        }
      `}</style>
    </main>
  )
}

/* ===== Pagination ===== */
function Pagination({ page, total, onChange }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const go = (p) => onChange(Math.min(total, Math.max(1, p)))
  return (
    <div className="hx-pager">
      <button className="hx-pbtn" onClick={() => go(page - 1)} disabled={page === 1}>{'‹'}</button>
      {pages.map(p => (
        <button
          key={p}
          className={`hx-pbtn ${p === page ? 'hx-pbtn--active' : ''}`}
          onClick={() => go(p)}
        >{p}</button>
      ))}
      <button className="hx-pbtn" onClick={() => go(page + 1)} disabled={page === total}>{'›'}</button>
    </div>
  )
}
