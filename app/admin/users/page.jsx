'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ===== Telefon yardımcıları ===== */
const digits = (v='') => (v.match(/\d/g) || []).join('')
const toNat10 = (raw='') => { const d = digits(raw); return d.length >= 10 ? d.slice(-10) : d }
const isNat10 = (v) => /^\d{10}$/.test(v || '')
const asE164TR = (nat10) => `+90${nat10}`

/* ===== Tarih yardımcıları ===== */
const fmtDateTR = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('tr-TR') } catch { return '—' }
}
const daysLeft = (iso) => {
  if (!iso) return null
  const now = new Date()
  const end = new Date(iso)
  return Math.ceil((end.getTime() - now.getTime()) / (1000*60*60*24))
}

export default function AdminUsersPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [busyDeleteId, setBusyDeleteId] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      const { data: me, error: eMe } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (eMe) { setErr(eMe.message); setLoading(false); return }
      if (me?.role !== 'admin') { router.replace('/'); return }

      await load()

      const ch = supabase.channel('admin-users-live')
        .on('postgres_changes', { event:'*', schema:'public', table:'profiles' }, load)
        .subscribe()
      return () => supabase.removeChannel(ch)
    })()
  }, [router])

  async function safeJson(res) {
    try { const t = await res.text(); return t ? JSON.parse(t) : null } catch { return null }
  }

  async function load() {
    try {
      setLoading(true); setErr('')
      const url = q.trim() ? `/api/admin/users?q=${encodeURIComponent(q.trim())}` : '/api/admin/users'
      const res = await fetch(url, { cache: 'no-store' })
      const json = await safeJson(res)
      if (!res.ok || !json?.ok) throw new Error(json?.message || `Liste yüklenemedi (HTTP ${res.status})`)
      // rows: id, first_name, last_name, phone, role, credits, credits_expires_at
      setRows(json.rows || [])
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (r) => {
    const left = daysLeft(r.credits_expires_at)
    setEditingId(r.id)
    setForm({
      id: r.id,
      first_name: r.first_name || '',
      last_name:  r.last_name  || '',
      phone_nat10: toNat10(r.phone || ''),
      role: r.role || 'user',
      credits: Number(r.credits ?? 0),
      credit_days: r.credits_expires_at ? Math.max(0, left ?? 0) : 0, // 0 = sınırsız/bitmiş kabulü
      password: ''
    })
  }
  const cancelEdit = () => { setEditingId(null); setForm(null) }

  const saveEdit = async () => {
    try {
      if (!isNat10(form.phone_nat10)) throw new Error('Telefon 10 hane olmalı (5xxxxxxxxx)')
      setMsg('Kaydediliyor…'); setErr('')

      // 1) Profile
      const { error: e1 } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name,
          last_name:  form.last_name,
          phone:      asE164TR(form.phone_nat10),
          role:       form.role
        })
        .eq('id', form.id)
      if (e1) throw e1

      // 2) AUTH (opsiyonel)
      const old = rows.find(r => r.id === form.id)
      const oldNat10 = toNat10(old?.phone || '')
      const payload = { id: form.id }
      if (form.password) payload.password = form.password
      if (form.phone_nat10 !== oldNat10) payload.phone = asE164TR(form.phone_nat10)
      if (payload.password || payload.phone) {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload)
        })
        const json = await safeJson(res)
        if (!res.ok || !json?.ok) throw new Error(json?.message || `AUTH güncellenemedi (HTTP ${res.status})`)
      }

      // 3) Kredi + gün (RPC) — GÜNCELLENDİ
      let amount = Math.max(0, Number(form.credits || 0))
      const days = Math.max(0, Number(form.credit_days || 0))
      // gün = 0 ise kredi anında 0 olmalı
      if (days === 0) amount = 0
      // sadece >0 gün süre ver; 0 ise null (süre yok/bitmiş)
      const p_days = days > 0 ? days : null

      const { error: e2 } = await supabase.rpc('admin_set_credits', {
        p_user_id: form.id,
        p_amount : amount,
        p_days   : p_days
      })
      if (e2) throw e2

      setMsg('Kaydedildi ✅')
      setEditingId(null); setForm(null)
      await load()
    } catch (e) {
      setErr(e.message || String(e))
    } finally { setTimeout(()=>setMsg(''), 1500) }
  }

  async function handleDelete(id) {
    if (!id) { setErr('Geçersiz ID'); return }
    if (busyDeleteId === id) return
    if (!window.confirm('Bu hesabı kalıcı olarak silmek istiyor musunuz?')) return

    try {
      setBusyDeleteId(id)
      setMsg('Siliniyor…'); setErr('')
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await safeJson(res)
      if (!res.ok || !(json?.ok)) throw new Error(json?.message || `İstek başarısız (HTTP ${res.status})`)
      setMsg('Hesap silindi ✅')
      await load()
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setTimeout(()=>setMsg(''), 1500)
      setBusyDeleteId(null)
    }
  }

  // Yeni kullanıcı
  const [newRow, setNewRow] = useState({
    password:'', first_name:'', last_name:'', phone_nat10:'',
    credits:0, credit_days:0, role:'user'
  })

  const createUser = async () => {
    try {
      if (!isNat10(newRow.phone_nat10)) throw new Error('Telefon 10 hane olmalı (5xxxxxxxxx)')
      if (!newRow.password) throw new Error('Parola zorunlu')

      setMsg('Oluşturuluyor…'); setErr('')
      // 1) auth + temel profil
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          phone: asE164TR(newRow.phone_nat10), password: newRow.password,
          first_name: newRow.first_name, last_name: newRow.last_name,
          credits: 0, role: newRow.role
        })
      })
      const json = await safeJson(res)
      if (!res.ok || !json?.ok) throw new Error(json?.message || `Oluşturulamadı (HTTP ${res.status})`)

      const newId = json.user?.id || json.id || null
      if (!newId) throw new Error('Yeni kullanıcı ID’si alınamadı')

      // 2) Kredi & gün RPC — GÜNCELLENDİ
      let amount = Math.max(0, Number(newRow.credits || 0))
      const days = Math.max(0, Number(newRow.credit_days || 0))
      if (days === 0) amount = 0
      const p_days = days > 0 ? days : null

      const { error: e2 } = await supabase.rpc('admin_set_credits', {
        p_user_id: newId,
        p_amount : amount,
        p_days   : p_days
      })
      if (e2) throw e2

      setMsg('Kullanıcı oluşturuldu ✅')
      setNewRow({ first_name:'', last_name:'', phone_nat10:'', password:'', credits:0, credit_days:0, role:'user' })
      await load()
    } catch (e) {
      setErr(e.message || String(e))
    } finally { setTimeout(()=>setMsg(''), 1500) }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main className="wrap">
      <h2 className="title">Kullanıcı İşlemleri</h2>
      {msg && <div className="okBox" role="status">{msg}</div>}
      {err && <div className="errBox" role="alert">Hata: {err}</div>}

      <div className="toolbar">
        <input
          placeholder="Ara: ad, soyad veya telefon"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==='Enter') load() }}
          className="searchInput"
        />
        <button onClick={load} className="btn">Ara</button>
      </div>

      {/* Masaüstü tablo */}
      <div className="tableScroll">
        <table className="table" role="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Soyad</th>
              <th>Telefon</th>
              <th>Parola</th>
              <th>Rol</th>
              <th>Kredi</th>
              <th>Kredi Günleri</th>
              <th>Bitiş</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {/* Yeni kullanıcı satırı */}
            <tr>
              <td><input className="input" value={newRow.first_name} onChange={e=>setNewRow({...newRow,first_name:e.target.value})}/></td>
              <td><input className="input" value={newRow.last_name}  onChange={e=>setNewRow({...newRow,last_name:e.target.value})}/></td>
              <td>
                <div className="phoneRow">
                  <input value="+90" readOnly disabled className="input prefix" />
                  <input
                    className="input"
                    inputMode="numeric"
                    pattern="\\d{10}"
                    maxLength={10}
                    value={newRow.phone_nat10}
                    onChange={e=>setNewRow({...newRow,phone_nat10: digits(e.target.value).slice(0,10) })}
                    placeholder="5xxxxxxxxx"
                  />
                </div>
                {!isNat10(newRow.phone_nat10) && newRow.phone_nat10 && <div className="hint">10 hane olmalı</div>}
              </td>
              <td><input className="input" type="password" value={newRow.password} onChange={e=>setNewRow({...newRow,password:e.target.value})} placeholder="Parola"/></td>
              <td>
                <select className="input" value={newRow.role} onChange={e=>setNewRow({...newRow,role:e.target.value})}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td><input className="input" type="number" min={0} value={newRow.credits} onChange={e=>setNewRow({...newRow,credits:Number(e.target.value||0)})}/></td>
              <td><input className="input" type="number" min={0} value={newRow.credit_days} onChange={e=>setNewRow({...newRow,credit_days:Number(e.target.value||0)})} placeholder="örn 30"/></td>
              <td>—</td>
              <td>
                <button
                  className="btn primary"
                  disabled={!isNat10(newRow.phone_nat10) || !newRow.password}
                  onClick={createUser}
                >
                  + Ekle
                </button>
              </td>
            </tr>

            {/* Mevcut kayıtlar */}
            {rows.map(r => {
              const isEdit = editingId === r.id
              const exp = r.credits_expires_at
              const left = daysLeft(exp)

              return (
                <tr key={r.id}>
                  <td>{isEdit ? <input className="input" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/> : (r.first_name||'')}</td>
                  <td>{isEdit ? <input className="input" value={form.last_name}  onChange={e=>setForm({...form,last_name:e.target.value})}/> : (r.last_name||'')}</td>
                  <td>
                    {isEdit ? (
                      <div className="phoneRow">
                        <input value="+90" readOnly disabled className="input prefix" />
                        <input
                          className="input"
                          inputMode="numeric"
                          pattern="\\d{10}"
                          maxLength={10}
                          value={form.phone_nat10}
                          onChange={e=>setForm({...form,phone_nat10: digits(e.target.value).slice(0,10) })}
                        />
                      </div>
                    ) : (r.phone || '')}
                    {isEdit && !isNat10(form.phone_nat10) && form.phone_nat10 && <div className="hint">10 hane olmalı</div>}
                  </td>
                  <td>{isEdit ? <input className="input" type="password" placeholder="(opsiyonel)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/> : '—'}</td>
                  <td>
                    {isEdit
                      ? <select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      : r.role}
                  </td>

                  {/* Kredi */}
                  <td>{isEdit
                    ? <input className="input" type="number" min={0} value={form.credits} onChange={e=>setForm({...form,credits:Number(e.target.value||0)})}/>
                    : (r.credits ?? 0)}</td>

                  {/* Kredi Günleri: kalan gün */}
                  <td>{isEdit
                    ? <input className="input" type="number" min={0} value={form.credit_days} onChange={e=>setForm({...form,credit_days:Number(e.target.value||0)})} placeholder="örn 30"/>
                    : (exp ? Math.max(0, left ?? 0) : 0)}</td>

                  {/* Bitiş: yalnız tarih */}
                  <td>{fmtDateTR(exp)}</td>

                  <td className="actions">
                    {isEdit ? (
                      <>
                        <button className="btn xs primary" disabled={!isNat10(form.phone_nat10)} onClick={saveEdit}>Kaydet</button>
                        <button className="btn xs" onClick={cancelEdit}>İptal</button>
                      </>
                    ) : (
                      <>
                        <button className="btn xs" onClick={()=>startEdit(r)}>Düzenle</button>
                        <button
                          className="btn xs danger"
                          onClick={() => handleDelete(r.id)}
                          disabled={busyDeleteId === r.id}
                        >
                          {busyDeleteId === r.id ? 'Siliniyor…' : 'Sil'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="empty">Kayıt yok</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobil kart görünümü */}
      <ul className="cards">
        {/* Yeni kullanıcı kartı */}
        <li className="card">
          <h3 className="cardTitle">Yeni Kullanıcı</h3>
          <div className="grid2">
            <input className="input" placeholder="Ad" value={newRow.first_name} onChange={e=>setNewRow({...newRow,first_name:e.target.value})}/>
            <input className="input" placeholder="Soyad" value={newRow.last_name} onChange={e=>setNewRow({...newRow,last_name:e.target.value})}/>
          </div>
          <div className="grid2">
            <input className="input" value="+90" readOnly disabled />
            <input className="input" inputMode="numeric" maxLength={10} placeholder="5xxxxxxxxx" value={newRow.phone_nat10} onChange={e=>setNewRow({...newRow,phone_nat10: digits(e.target.value).slice(0,10) })}/>
          </div>
          {!isNat10(newRow.phone_nat10) && newRow.phone_nat10 && <div className="hint">Telefon 10 hane olmalı</div>}
          <input className="input" type="password" placeholder="Parola" value={newRow.password} onChange={e=>setNewRow({...newRow,password:e.target.value})}/>
          <div className="grid2">
            <select className="input" value={newRow.role} onChange={e=>setNewRow({...newRow,role:e.target.value})}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <input className="input" type="number" placeholder="Başlangıç kredisi" min={0} value={newRow.credits} onChange={e=>setNewRow({...newRow,credits:Number(e.target.value||0)})}/>
          </div>
          <input className="input" type="number" placeholder="Kredi günleri (örn 30)" min={0} value={newRow.credit_days} onChange={e=>setNewRow({...newRow,credit_days:Number(e.target.value||0)})}/>
          <button className="btn primary w100" disabled={!isNat10(newRow.phone_nat10) || !newRow.password} onClick={createUser}>+ Ekle</button>
        </li>

        {/* Kayıt kartları */}
        {rows.map(r => {
          const isEdit = editingId === r.id
          const exp = r.credits_expires_at
          const left = daysLeft(exp)

          return (
            <li key={r.id} className="card">
              <div className="cardTitle">
                {r.first_name || '-'} {r.last_name || ''}
              </div>

              {isEdit ? (
                <>
                  <div className="grid2">
                    <input className="input" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/>
                    <input className="input" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/>
                  </div>
                  <div className="grid2">
                    <input className="input" value="+90" readOnly disabled />
                    <input className="input" inputMode="numeric" maxLength={10} value={form.phone_nat10} onChange={e=>setForm({...form,phone_nat10: digits(e.target.value).slice(0,10) })}/>
                  </div>
                  {!isNat10(form.phone_nat10) && form.phone_nat10 && <div className="hint">Telefon 10 hane olmalı</div>}
                  <input className="input" type="password" placeholder="(opsiyonel yeni parola)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>

                  <div className="grid2">
                    <select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <input className="input" type="number" min={0} value={form.credits} onChange={e=>setForm({...form,credits:Number(e.target.value||0)})}/>
                  </div>
                  <input className="input" type="number" min={0} value={form.credit_days} onChange={e=>setForm({...form,credit_days:Number(e.target.value||0)})} placeholder="Kredi günleri"/>

                  <div className="meta"><b>Bitiş:</b> {fmtDateTR(rows.find(x=>x.id===form.id)?.credits_expires_at)}</div>
                </>
              ) : (
                <>
                  <div className="meta"><b>Tel:</b> {r.phone || '-'}</div>
                  <div className="meta"><b>Kredi:</b> {r.credits ?? 0}</div>
                  <div className="meta"><b>Kredi Günleri (kalan):</b> {exp ? Math.max(0, left ?? 0) : 0}</div>
                  <div className="meta"><b>Bitiş:</b> {fmtDateTR(exp)}</div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <style jsx>{`
        :root { --maxw: 1200px; --radius: 12px; --fg:#111; --muted:#555; --muted2:#777; --br:#e5e5e5; --primary:#007b55; }
        .wrap { max-width: var(--maxw); margin: 24px auto; padding: 0 12px 24px; color: var(--fg); font-family: Arial, sans-serif }
        .title { border-bottom: 2px solid var(--primary); padding-bottom: 6px; margin-bottom: 12px }
        .okBox { color: #0a7; margin-top: 8px }
        .errBox { color: crimson; margin-top: 8px }

        .toolbar { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap }
        .searchInput { padding: 10px 12px; border: 1px solid #ddd; border-radius: 10px; min-width: 240px; font-size: 16px }
        .btn { padding: 10px 12px; border: 1px solid #ddd; background: #fff; border-radius: 10px; cursor: pointer; font-size: 14px }
        .btn.primary { background: #007b55; color: #fff; border-color: #007b55 }
        .btn.danger { background: #e74c3c; color: #fff; border-color: #e74c3c }
        .btn.xs { padding: 6px 10px; font-size: 13px }
        .btn.w100 { width: 100% }

        .tableScroll { max-height: 70vh; overflow: auto; border: 1px solid #eee; border-radius: 10px; display: none }
        .table { width: 100%; border-collapse: collapse; min-width: 980px }
        thead tr { background: #fafafa; position: sticky; top: 0; z-index: 1 }
        th, td { padding: 10px; border-bottom: 1px solid #f4f4f4; text-align: left; font-size: 14px }
        th { border-bottom: 1px solid #eee; font-weight: 700; font-size: 14px }
        .actions { white-space: nowrap; display: flex; gap: 6px }
        .input { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; font-size: 14px }
        .input.prefix { text-align: center; background: #f7f7f7; color: #555 }
        .phoneRow { display: grid; grid-template-columns: 72px 1fr; gap: 8px }
        .hint { font-size: 12px; color: crimson; margin-top: 4px }
        .empty { text-align: center; color: #666; padding: 12px }

        .cards { display: grid; gap: 12px; list-style: none; padding: 0; margin: 12px 0 0 }
        .card { border: 1px solid #e5e5e5; border-radius: var(--radius); background: #fafafa; padding: 12px }
        .cardTitle { font-weight: 700; margin: 0 0 8px; display: flex; align-items: center; gap: 8px }
        .meta { font-size: 14px; color: var(--muted); margin: 4px 0 }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px }
        .actionsRow { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px }

        @media (min-width: 768px) {
          .tableScroll { display: block }
          .cards { display: none }
          .wrap { padding: 0 16px 24px }
        }
        @media (max-width: 480px) {
          .searchInput { width: 100%; font-size: 16px }
          .btn { font-size: 16px }
          .input { font-size: 16px }
          .grid2 { grid-template-columns: 1fr }
          .actionsRow { grid-template-columns: 1fr 1fr }
        }
      `}</style>
    </main>
  )
}
