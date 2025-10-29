'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Telefon yardımcıları: 10 hane (ulusal), DB'ye +90 ile yaz */
const digits = (v='') => (v.match(/\d/g) || []).join('')
const toNat10 = (raw='') => {
  const d = digits(raw)
  return d.length >= 10 ? d.slice(-10) : d
}
const isNat10 = (v) => /^\d{10}$/.test(v || '')
const asE164TR = (nat10) => `+90${nat10}`

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
    try {
      const t = await res.text()
      return t ? JSON.parse(t) : null
    } catch { return null }
  }

  async function load() {
    try {
      setLoading(true); setErr('')
      const url = q.trim() ? `/api/admin/users?q=${encodeURIComponent(q.trim())}` : '/api/admin/users'
      const res = await fetch(url, { cache: 'no-store' })
      const json = await safeJson(res)
      if (!res.ok || !json?.ok) throw new Error(json?.message || `Liste yüklenemedi (HTTP ${res.status})`)
      setRows(json.rows || [])
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (r) => {
    setEditingId(r.id)
    setForm({
      id: r.id,
      first_name: r.first_name || '',
      last_name:  r.last_name  || '',
      phone_nat10: toNat10(r.phone || ''),   // yalnız 10 hane
      credits:    r.credits ?? 0,
      role:       r.role || 'user',
      password:   ''                          // opsiyonel reset
    })
  }
  const cancelEdit = () => { setEditingId(null); setForm(null) }

  const saveEdit = async () => {
    try {
      if (!isNat10(form.phone_nat10)) throw new Error('Telefon 10 hane olmalı (5xxxxxxxxx)')
      setMsg('Kaydediliyor…'); setErr('')

      // 1) Profiles
      const { error: e1 } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name,
          last_name:  form.last_name,
          phone:      asE164TR(form.phone_nat10), // +90 ile kaydet
          credits:    Number(form.credits||0),
          role:       form.role
        })
        .eq('id', form.id)
      if (e1) throw e1

      // 2) AUTH (parola/telefon değiştiyse)
      const old = rows.find(r => r.id === form.id)
      const oldNat10 = toNat10(old?.phone || '')
      const payload = { id: form.id }
      if (form.password) payload.password = form.password
      if (form.phone_nat10 !== oldNat10) payload.phone = asE164TR(form.phone_nat10)

      if (payload.password || payload.phone) {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        })
        const json = await safeJson(res)
        if (!res.ok || !json?.ok) throw new Error(json?.message || `AUTH güncellenemedi (HTTP ${res.status})`)
      }

      setMsg('Kaydedildi ✅')
      setEditingId(null); setForm(null)
      await load()
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setTimeout(()=>setMsg(''), 1500)
    }
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
      if (!res.ok || !(json?.ok)) {
        const message = json?.message || `İstek başarısız (HTTP ${res.status})`
        throw new Error(message)
      }

      setMsg('Hesap silindi ✅')
      await load()
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setTimeout(()=>setMsg(''), 1500)
      setBusyDeleteId(null)
    }
  }

  // Yeni kullanıcı: SADECE telefon(10h) + parola zorunlu
  const [newRow, setNewRow] = useState({
    password:'', first_name:'', last_name:'', phone_nat10:'', credits:0, role:'user'
  })

  const createUser = async () => {
    try {
      if (!isNat10(newRow.phone_nat10)) throw new Error('Telefon 10 hane olmalı (5xxxxxxxxx)')
      if (!newRow.password) throw new Error('Parola zorunlu')

      setMsg('Oluşturuluyor…'); setErr('')
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          phone: asE164TR(newRow.phone_nat10), // +90… formatı
          password: newRow.password,
          first_name: newRow.first_name,
          last_name: newRow.last_name,
          credits: newRow.credits,
          role: newRow.role
        })
      })

      const json = await safeJson(res)
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `Oluşturulamadı (HTTP ${res.status})`)
      }

      setMsg('Kullanıcı oluşturuldu ✅')
      setNewRow({ first_name:'', last_name:'', phone_nat10:'', password:'', credits:0, role:'user' })
      await load()
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setTimeout(()=>setMsg(''), 1500)
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main style={wrap}>
      <h2 style={title}>Kullanıcı İşlemleri</h2>
      {msg && <div style={okBox}>{msg}</div>}
      {err && <div style={errBox}>Hata: {err}</div>}

      <div style={toolbar}>
        <input
          placeholder="Ara: ad, soyad veya telefon"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==='Enter') load() }}
          style={searchInput}
        />
        <button onClick={load} style={btn}>Ara</button>
      </div>

      <div className="scroll-vertical" style={{ ...tableScroll, marginBottom:10 }}>
        <table style={table}>
          <thead>
            <tr style={{ background:'#fafafa', position:'sticky', top:0 }}>
              <th style={th}>Ad</th>
              <th style={th}>Soyad</th>
              <th style={th}>Telefon</th>
              <th style={th}>Parola</th>
              <th style={th}>Rol</th>
              <th style={th}>Kredi</th>
              <th style={th}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {/* Yeni kullanıcı satırı */}
            <tr>
              <td style={td}><input style={inputStyle} value={newRow.first_name} onChange={e=>setNewRow({...newRow,first_name:e.target.value})}/></td>
              <td style={td}><input style={inputStyle} value={newRow.last_name}  onChange={e=>setNewRow({...newRow,last_name:e.target.value})}/></td>
              <td style={td}>
                <div style={{ display:'grid', gridTemplateColumns:'72px 1fr', gap:8 }}>
                  <input value="+90" readOnly disabled style={{ ...inputStyle, textAlign:'center', background:'#f7f7f7', color:'#555' }}/>
                  <input
                    style={inputStyle}
                    inputMode="numeric"
                    pattern="\d{10}"
                    maxLength={10}
                    value={newRow.phone_nat10}
                    onChange={e=>setNewRow({...newRow,phone_nat10: digits(e.target.value).slice(0,10) })}
                    placeholder="5xxxxxxxxx"
                  />
                </div>
                {!isNat10(newRow.phone_nat10) && newRow.phone_nat10 && <div style={hint}>10 hane olmalı</div>}
              </td>
              <td style={td}>
                <input style={inputStyle} type="password" value={newRow.password} onChange={e=>setNewRow({...newRow,password:e.target.value})} placeholder="Parola"/>
              </td>
              <td style={td}>
                <select style={inputStyle} value={newRow.role} onChange={e=>setNewRow({...newRow,role:e.target.value})}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td style={td}><input style={inputStyle} type="number" value={newRow.credits} onChange={e=>setNewRow({...newRow,credits:Number(e.target.value||0)})}/></td>
              <td style={td}>
                <button
                  style={btnPrimary}
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
              return (
                <tr key={r.id}>
                  <td style={td}>{isEdit ? <input style={inputStyle} value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/> : (r.first_name||'')}</td>
                  <td style={td}>{isEdit ? <input style={inputStyle} value={form.last_name}  onChange={e=>setForm({...form,last_name:e.target.value})}/> : (r.last_name||'')}</td>
                  <td style={td}>
                    {isEdit ? (
                      <div style={{ display:'grid', gridTemplateColumns:'72px 1fr', gap:8 }}>
                        <input value="+90" readOnly disabled style={{ ...inputStyle, textAlign:'center', background:'#f7f7f7', color:'#555' }}/>
                        <input
                          style={inputStyle}
                          inputMode="numeric"
                          pattern="\d{10}"
                          maxLength={10}
                          value={form.phone_nat10}
                          onChange={e=>setForm({...form,phone_nat10: digits(e.target.value).slice(0,10) })}
                        />
                      </div>
                    ) : (r.phone || '')}
                    {isEdit && !isNat10(form.phone_nat10) && form.phone_nat10 && <div style={hint}>10 hane olmalı</div>}
                  </td>
                  <td style={td}>{isEdit ? <input style={inputStyle} type="password" placeholder="(opsiyonel)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/> : '—'}</td>
                  <td style={td}>
                    {isEdit
                      ? <select style={inputStyle} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      : r.role}
                  </td>
                  <td style={td}>{isEdit ? <input style={inputStyle} type="number" value={form.credits} onChange={e=>setForm({...form,credits:Number(e.target.value||0)})}/> : (r.credits ?? 0)}</td>
                  <td style={{ ...td, whiteSpace:'nowrap', display:'flex', gap:6 }}>
                    {isEdit ? (
                      <>
                        <button style={btnXsPrimary} disabled={!isNat10(form.phone_nat10)} onClick={saveEdit}>Kaydet</button>
                        <button style={btnXs} onClick={cancelEdit}>İptal</button>
                      </>
                    ) : (
                      <>
                        <button style={btnXs} onClick={()=>startEdit(r)}>Düzenle</button>
                        <button
                          style={btnXsDanger}
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
              <tr><td colSpan={7} style={{ textAlign:'center', color:'#666', padding:12 }}>Kayıt yok</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}

/* Styles */
const wrap   = { maxWidth: 1200, margin:'24px auto', padding:'0 16px', fontFamily:'Arial, sans-serif', color:'#111' }
const title  = { borderBottom:'2px solid #007b55', paddingBottom:6, marginBottom:12 }
const okBox  = { color:'#0a7', marginTop:8 }
const errBox = { color:'crimson', marginTop:8 }

const toolbar = { display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }
const searchInput = { padding:'8px 10px', border:'1px solid #ddd', borderRadius:8, minWidth:260 }

const btn = { padding:'8px 12px', borderWidth:1, borderStyle:'solid', borderColor:'#ddd', borderRadius:8, background:'#fff', cursor:'pointer' }
const btnPrimary = { ...btn, background:'#007b55', color:'#fff', borderColor:'#007b55' }
const btnXs = { ...btn, padding:'4px 8px', fontSize:13 }
const btnXsPrimary = { ...btnXs, background:'#007b55', color:'#fff', borderColor:'#007b55' }
const btnXsDanger = { ...btnXs, background:'#e74c3c', color:'#fff', borderColor:'#e74c3c' }

const tableScroll = { maxHeight:'70vh', overflowY:'auto', paddingRight:6, border:'1px solid #eee', borderRadius:10 }
const table = { width:'100%', borderCollapse:'collapse' }
const th = { borderBottom:'1px solid #eee', padding:'10px', textAlign:'left', fontWeight:700, fontSize:14, position:'sticky', top:0, background:'#fafafa' }
const td = { borderBottom:'1px solid #f4f4f4', padding:'8px 10px', textAlign:'left', fontSize:14 }
const inputStyle = { width:'100%', padding:'6px 8px', border:'1px solid #ddd', borderRadius:6 }
const hint = { fontSize:12, color:'crimson', marginTop:4 }
