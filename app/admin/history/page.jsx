'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ==== Yardımcılar ==== */
const pad = (n) => String(n).padStart(2, '0')
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
const addDaysISO = (yyyyMMdd, n) => {
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  dt.setDate(dt.getDate()+n)
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`
}
const nowIsoMinute = () => new Date().toISOString().slice(0,16)

/* Türkçe uzun tarih formatı */
function trLongDate(yyyyMMdd) {
  if (!yyyyMMdd) return ''
  const [y,m,d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y,(m||1)-1,d||1)
  const cap = (s) => s ? s.charAt(0).toUpperCase()+s.slice(1) : s
  const day = dt.toLocaleDateString('tr-TR',{day:'2-digit'})
  const month = cap(dt.toLocaleDateString('tr-TR',{month:'long'}))
  const year = dt.getFullYear()
  const weekday = cap(dt.toLocaleDateString('tr-TR',{weekday:'long'}))
  return `${day} ${month} ${year} ${weekday}`
}

export default function AdminHistoryPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [pickedDate, setPickedDate] = useState('')
  const today = useMemo(() => todayISO(), [])
  const nowMin = useMemo(() => nowIsoMinute(), [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      await loadHistory()
    })().catch(e => { setErr(e.message || String(e)); setLoading(false) })
  }, [router])

  async function loadHistory() {
    try {
      setLoading(true); setErr('')

      // sadece approved olanları alıyoruz
      const { data: bookings, error: e1 } = await supabase
        .from('bookings')
        .select('id, status, slot_id, user_id')
        .eq('status', 'approved')
      if (e1) throw e1
      if (!bookings?.length) { setRows([]); return }

      const slotIds = [...new Set(bookings.map(b => b.slot_id).filter(Boolean))]
      const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]

      let slotsById = new Map()
      if (slotIds.length) {
        const { data: slots, error: eS } = await supabase
          .from('slots')
          .select('id, date, time, duration_minutes')
          .in('id', slotIds)
        if (eS) throw eS
        slotsById = new Map((slots ?? []).map(s => [s.id, s]))
      }

      let profilesById = new Map()
      if (userIds.length) {
        const { data: profiles, error: eP } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone')
          .in('id', userIds)
        if (eP) throw eP
        profilesById = new Map((profiles ?? []).map(p => [p.id, p]))
      }

      // yalnızca zamanı geçmiş approved kayıtlar
      const merged = bookings
        .map(b => ({
          ...b,
          slot: slotsById.get(b.slot_id),
          profile: profilesById.get(b.user_id)
        }))
        .filter(r => {
          if (!r.slot) return false
          const dt = `${r.slot.date}T${r.slot.time}`
          return dt <= nowMin // geçmişteyse
        })
        .sort((a,b) => {
          const ad = `${a.slot?.date ?? ''}T${a.slot?.time ?? ''}`
          const bd = `${b.slot?.date ?? ''}T${b.slot?.time ?? ''}`
          return bd.localeCompare(ad)
        })

      setRows(merged)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  /* 30 gün / tarih filtresi */
  const last30Start = addDaysISO(today, -30)
  const filtered = rows
    .filter(r => {
      if (!r.slot) return false
      if (pickedDate) return r.slot.date === pickedDate
      return r.slot.date >= last30Start && r.slot.date <= today
    })

  if (loading) {
    return (
      <main className="wrap">
        <div className="skeleton">
          <div className="sk-title"/>
          <div className="sk-card"/>
          <div className="sk-card"/>
        </div>
        <style jsx>{`
          .wrap { padding: 16px }
          .skeleton { max-width: 860px; margin: 0 auto }
          .sk-title { height: 28px; width: 60%; border-radius: 8px; background: #eee; margin: 8px 0 16px }
          .sk-card { height: 96px; border-radius: 12px; background: #f2f2f2; margin: 8px 0 }
        `}</style>
      </main>
    )
  }

  return (
    <main className="wrap">
      <header className="header">
        <h2>Geçmiş Randevular</h2>
        {err && <div className="err">Hata: {err}</div>}
      </header>

      <div className="filters" role="region" aria-label="Filtreler">
        <label className="label">
          <span>Eski bir gün seç:</span>
          <input
            type="date"
            max={today}
            value={pickedDate}
            onChange={(e) => setPickedDate(e.target.value)}
            className="dateInput"
          />
        </label>
        {pickedDate && (
          <button onClick={() => setPickedDate('')} className="clearBtn" aria-label="Tarihi temizle">
            ✕ Temizle (Son 30 gün)
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="empty">
          {pickedDate
            ? `${trLongDate(pickedDate)} için tamamlanan randevu yok.`
            : 'Son 30 günde tamamlanan randevu bulunmuyor.'}
        </p>
      ) : (
        <div className="scroller" role="feed">
          <ul className="list">
            {filtered.map(r => {
              const s = r.slot
              const p = r.profile || {}
              const fullName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '(İsim yok)'
              return (
                <li key={r.id} className="card" role="article">
                  <div className="row">
                    <div className="info">
                      <b className="date">{trLongDate(s.date)}</b>
                      <div className="time">{s.time} <span className="dot"/> {s.duration_minutes} dk</div>
                      <div className="muted">Hasta: <b>{fullName}</b></div>
                      <div className="muted">Tel: {p.phone ?? '-'}</div>
                    </div>
                    <span className="badgeDone">Tamamlandı ✅</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <style jsx>{`
        :root {
          --maxw: 860px;
          --radius: 14px;
          --bg: #fafafa;
          --fg: #111;
          --muted: #555;
          --muted-2: #777;
          --primary: #007b55;
          --ok-bg: #e7f6ec;
          --ok-br: #bce3c7;
        }
        .wrap {
          color: var(--fg);
          background: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
          margin: 0 auto;
          padding: 12px 12px 24px;
          max-width: var(--maxw);
        }
        .header { position: sticky; top: 0; z-index: 10; background: white; padding: 8px 0 10px; border-bottom: 2px solid var(--primary); margin-bottom: 8px }
        .header h2 { font-size: 1.25rem; line-height: 1.2 }
        .err { color: crimson; margin-top: 6px; font-size: .95rem }

        .filters { position: sticky; top: 54px; z-index: 9; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: white; padding: 8px 0 10px; border-bottom: 1px dashed #e5e5e5; margin-bottom: 8px }
        .label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #333 }
        .dateInput { appearance: none; -webkit-appearance: none; padding: 8px 10px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px }
        .clearBtn { background: #eee; border: 1px solid #ddd; border-radius: 10px; padding: 8px 12px; cursor: pointer; font-size: 14px }
        .clearBtn:active { transform: translateY(1px) }

        .empty { padding: 8px 2px }

        .scroller { max-height: 70vh; overflow-y: auto; padding: 4px; -webkit-overflow-scrolling: touch }
        .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px }
        .card { border: 1px solid #e5e5e5; border-radius: var(--radius); background: var(--bg); padding: 12px; -webkit-tap-highlight-color: transparent }

        .row { display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 8px }
        .info { min-width: 0 }
        .date { display: block; font-size: 1rem }
        .time { font-size: .95rem; margin: 2px 0 6px }
        .dot { display: inline-block; width: 4px; height: 4px; border-radius: 999px; background: #aaa; margin: 0 6px }
        .muted { font-size: .95rem; color: var(--muted) }

        .badgeDone { white-space: nowrap; align-self: start; border: 1px solid var(--ok-br); border-radius: 999px; padding: 6px 10px; font-size: .9rem; font-weight: 700; color: #1e7e34; background: var(--ok-bg) }

        /* ====== Mobil iyileştirmeler ====== */
        @media (max-width: 480px) {
          .wrap { padding: 12px 10px 24px }
          .header h2 { font-size: 1.1rem }
          .filters { top: 48px }
          .label { width: 100%; justify-content: space-between }
          .dateInput { width: 100%; padding: 10px 12px; font-size: 16px } /* iOS zoom engelle */
          .clearBtn { width: 100%; text-align: center; padding: 10px 12px; font-size: 16px }
          .scroller { max-height: calc(100dvh - 150px) }
          .card { padding: 12px }
          .row { grid-template-columns: 1fr; }
          .badgeDone { justify-self: start; }
          .date { font-size: 1rem }
          .time { font-size: .95rem }
          .muted { font-size: .9rem }
          .list { gap: 8px }
        }

        /* Orta ekranlar */
        @media (min-width: 481px) and (max-width: 768px) {
          .header h2 { font-size: 1.2rem }
          .scroller { max-height: 65vh }
          .card { padding: 14px }
        }

        /* Büyük ekranlar */
        @media (min-width: 769px) {
          .wrap { padding: 0 16px 24px; margin-top: 24px }
          .header h2 { font-size: 1.35rem }
          .scroller { max-height: 60vh }
          .card { padding: 16px }
          .date { font-size: 1.05rem }
        }
      `}</style>
    </main>
  )
}
