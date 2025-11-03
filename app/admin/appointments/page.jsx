'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* TR uzun tarih */
const trLongDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return ''
  const [y, m, d] = yyyyMMdd.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
  const day = dt.toLocaleDateString('tr-TR', { day: '2-digit' })
  const month = cap(dt.toLocaleDateString('tr-TR', { month: 'long' }))
  const year = dt.getFullYear()
  const weekday = cap(dt.toLocaleDateString('tr-TR', { weekday: 'long' }))
  return `${day} ${month} ${year} ${weekday}`
}

export default function AdminUpcomingAppointments() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Not: sayfa mount olduğunda hesaplanan "şimdi" karşılaştırması yeterli.
  const nowIsoMin = useMemo(() => new Date().toISOString().slice(0, 16), [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      await loadAll()
      // realtime: bookings/slots değişince yenile
      const ch1 = supabase.channel('admin-upcoming-bookings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, loadAll)
        .subscribe()
      const ch2 = supabase.channel('admin-upcoming-slots')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, loadAll)
        .subscribe()
      return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
    })()
  }, [router])

  const loadAll = async () => {
    try {
      setLoading(true); setErr('')

      // 1) Sadece 'booked' rezervasyonlar
      const { data: bookings, error: e1 } = await supabase
        .from('bookings')
        .select('id, status, created_at, slot_id, user_id')
        .eq('status', 'booked')
      if (e1) throw e1
      if (!bookings?.length) { setRows([]); return }

      // 2) İlgili slot ve hasta profilleri
      const slotIds = [...new Set(bookings.map(b => b.slot_id).filter(Boolean))]
      const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]

      const [{ data: slots, error: e2 }, { data: profiles, error: e3 }] = await Promise.all([
        supabase.from('slots').select('id, date, time, duration_minutes').in('id', slotIds),
        supabase.from('profiles').select('id, first_name, last_name, phone').in('id', userIds),
      ])
      if (e2) throw e2
      if (e3) throw e3

      const slotMap = new Map((slots ?? []).map(s => [s.id, s]))
      const profMap = new Map((profiles ?? []).map(p => [p.id, p]))

      // 3) Birleştir + sadece GELECEK randevular
      const upcoming = bookings
        .map(b => ({ ...b, slot: slotMap.get(b.slot_id), profile: profMap.get(b.user_id) }))
        .filter(r => {
          if (!r.slot) return false
          const dt = `${r.slot.date}T${r.slot.time}`
          return dt > nowIsoMin
        })
        .sort((a, b) => {
          const ad = `${a.slot.date}T${a.slot.time}`
          const bd = `${b.slot.date}T${b.slot.time}`
          return ad.localeCompare(bd)
        })

      setRows(upcoming)
    } catch (e) {
      setErr(e.message || String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

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
        <h2>Yaklaşan Randevular</h2>
        {err && <div className="err">Hata: {err}</div>}
      </header>

      {rows.length === 0 ? (
        <p className="empty">Yaklaşan randevu yok.</p>
      ) : (
        <div className="scroller" role="feed" aria-busy={loading}>
          <ul className="list">
            {rows.map(r => {
              const s = r.slot
              const p = r.profile || {}
              const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '(İsim yok)'
              return (
                <li key={r.id} className="card" role="article">
                  <div className="rowTop">
                    <div className="info">
                      <b className="date">{trLongDate(s.date)}</b>
                      <div className="time">{s.time} <span className="dot"/> {s.duration_minutes} dk</div>
                      <div className="muted">Hasta: <b>{name}</b></div>
                      <div className="muted">Tel: {p.phone ?? '-'}</div>
                      <div className="mutedSmall">Oluşturulma: {new Date(r.created_at).toLocaleString('tr-TR')}</div>
                    </div>
                    <span className="badgeBooked">Randevu Oluşturuldu</span>
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
          margin: 0 auto;
          padding: 12px 12px 24px;
          max-width: var(--maxw);
        }
        .header { position: sticky; top: 0; z-index: 10; background: white; padding: 8px 0 10px; border-bottom: 2px solid var(--primary); margin-bottom: 8px }
        .header h2 { font-size: 1.25rem; line-height: 1.2 }
        .err { color: crimson; margin-top: 6px; font-size: .95rem }
        .empty { padding: 8px 2px }

        .scroller { max-height: 70vh; overflow-y: auto; padding: 4px; -webkit-overflow-scrolling: touch }
        .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px }
        .card { border: 1px solid #e5e5e5; border-radius: var(--radius); background: var(--bg); padding: 12px }

        .rowTop { display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 8px }
        .info { min-width: 0 }
        .date { display: block; font-size: 1rem }
        .time { font-size: .95rem; margin: 2px 0 6px }
        .dot { display: inline-block; width: 4px; height: 4px; border-radius: 999px; background: #aaa; margin: 0 6px }
        .muted { font-size: .95rem; color: var(--muted) }
        .mutedSmall { font-size: .85rem; color: var(--muted-2); margin-top: 2px }

        .badgeBooked { white-space: nowrap; align-self: start; border: 1px solid var(--ok-br); border-radius: 999px; padding: 6px 10px; font-size: .9rem; font-weight: 700; color: #1e7e34; background: var(--ok-bg) }

        /* ====== Mobil iyileştirmeler ====== */
        @media (max-width: 480px) {
          .wrap { padding: 12px 10px 24px }
          .header h2 { font-size: 1.1rem }
          .scroller { max-height: calc(100dvh - 120px) }
          .card { padding: 12px }
          .rowTop { grid-template-columns: 1fr; }
          .badgeBooked { justify-self: start; }
          .date { font-size: 1rem }
          .time { font-size: .95rem }
          .muted { font-size: .9rem }
          .mutedSmall { font-size: .8rem }
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

        /* Dokunmatik hedefleri büyütme */
        .card { -webkit-tap-highlight-color: transparent }
      `}</style>
    </main>
  )
}
