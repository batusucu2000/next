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

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main style={wrap}>
      <h2 style={title}>Geçmiş Randevularım</h2>
      {err && <div style={errBox}>Hata: {err}</div>}

      {/* Takvim (yalnız geçmiş günler seçilebilir) */}
      <div style={filterRow}>
        <label style={{ fontSize: 14, color: '#333' }}>
          Eski bir gün seç:
          <input
            type="date"
            max={today}
            value={pickedDate}
            onChange={(e) => { setPickedDate(e.target.value); setPage(1) }}
            style={dateInput}
          />
        </label>
        {pickedDate && (
          <button
            onClick={() => { setPickedDate(''); setPage(1) }}
            style={clearBtn}
            title="Son 30 güne dön"
          >
            ✕ Temizle (Son 30 gün)
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#444' }}>
          {pickedDate
            ? `${trLongDate(pickedDate)} için geçmiş randevu yok.`
            : 'Son 30 gün içinde geçmiş randevun bulunmuyor.'}
        </p>
      ) : (
        <>
          <div className="scroll-vertical" style={scrollArea}>
            <ul style={list}>
              {pageRows.map(r => {
                const st = badgeStyle(r.status)
                return (
                  <li key={r.id} style={card}>
                    <div style={rowTop}>
                      <div style={dateText}>
                        <b>{trLongDate(r.slot?.date)}</b> &nbsp; {r.slot?.time}
                        <span style={dot}>•</span>
                        <span style={muted}>{r.slot?.duration_minutes} dk</span>
                      </div>
                      <span style={{
                        border:'1px solid', borderColor: st.border,
                        borderRadius: 999, padding:'4px 10px',
                        fontSize: 13, fontWeight: 700,
                        color: st.color, background: st.bg
                      }}>
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
    </main>
  )
}

/* ===== Pagination ===== */
function Pagination({ page, total, onChange }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const go = (p) => onChange(Math.min(total, Math.max(1, p)))
  return (
    <div style={pagerWrap}>
      <button style={pagerBtn} onClick={() => go(page - 1)} disabled={page === 1}>{'‹'}</button>
      {pages.map(p => (
        <button
          key={p}
          style={{ ...pagerBtn, ...(p === page ? pagerBtnActive : {}) }}
          onClick={() => go(p)}
        >{p}</button>
      ))}
      <button style={pagerBtn} onClick={() => go(page + 1)} disabled={page === total}>{'›'}</button>
    </div>
  )
}

/* ===== Styles ===== */
const wrap   = { maxWidth: 860, margin: '24px auto', padding: '0 16px', fontFamily: 'Arial, sans-serif', color: '#111', background: '#fff' }
const title  = { borderBottom: '2px solid #007b55', paddingBottom: 6, marginBottom: 12 }

const filterRow = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }
const dateInput = { marginLeft: 8, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8 }
const clearBtn  = { background: '#eee', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }

const scrollArea = { maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }
const list   = { listStyle: 'none', padding: 0, display: 'grid', gap: 12 }
const card   = { border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, background: '#fafafa' }
const rowTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const dateText = { fontSize: 16 }
const dot    = { margin: '0 8px', color: '#aaa' }
const muted  = { fontSize: 13, color: '#666' }

const errBox = { color: 'crimson', marginTop: 8 }
const pagerWrap = { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }
const pagerBtn  = { minWidth: 34, height: 34, borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }
const pagerBtnActive = { background: '#0a7', color: '#fff', borderColor: '#0a7' }
