'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Telefon biçimlendirme */
const onlyDigits = (s='') => (s.match(/\d/g) || []).join('')
const toNational10 = (raw='') => {
  const d = onlyDigits(raw)
  return d.length >= 10 ? d.slice(-10) : d
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phoneNat10, setPhoneNat10] = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')

  const fullName = `${firstName}`.trim() + (lastName ? ` ${lastName}` : '')

  // Kullanıcı bilgilerini Auth + profiles üzerinden oku
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      // Profil bilgilerini oku
      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single()

      const f = prof?.first_name ?? user.user_metadata?.first_name ?? ''
      const l = prof?.last_name  ?? user.user_metadata?.last_name  ?? ''
      const p = user.phone || '' // doğrudan auth.users.phone

      setFirstName(f)
      setLastName(l)
      setPhoneNat10(toNational10(p))
      setLoading(false)
    })()
  }, [router])

  const validate = () => {
    if (!firstName.trim()) return 'İsim boş olamaz.'
    if (!lastName.trim())  return 'Soyisim boş olamaz.'
    if (password || password2) {
      if (password.length < 6) return 'Şifre en az 6 karakter olmalı.'
      if (password !== password2) return 'Şifreler eşleşmiyor.'
    }
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(''); setErr('')
    const v = validate()
    if (v) { setErr(v); return }

    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Oturum bulunamadı')

      // Şifre veya metadata güncelle
      const upd = {
        data: { first_name: firstName, last_name: lastName, full_name: fullName }
      }
      if (password) upd.password = password
      const { error } = await supabase.auth.updateUser(upd)
      if (error) throw error

      setMsg('Bilgileriniz güncellendi ✅')
      setPassword(''); setPassword2('')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main style={{ maxWidth: 640, margin: '24px auto', padding: '0 16px' }}>
      <h2 style={{ borderBottom: '2px solid #007b55', paddingBottom: 6 }}>
        Bilgilerimi Görüntüle / Güncelle
      </h2>

      {msg && <div style={{ marginTop: 12, color: '#0a7' }}>{msg}</div>}
      {err && <div style={{ marginTop: 12, color: 'crimson' }}>Hata: {err}</div>}

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: 'grid', gap: 14 }}>
        <Field label="İsim">
          <input value={firstName} disabled readOnly style={{ ...input, background:'#f7f7f7', color:'#555' }} />
        </Field>

        <Field label="Soyisim">
          <input value={lastName} disabled readOnly style={{ ...input, background:'#f7f7f7', color:'#555' }} />
        </Field>

        <Field label="Telefon Numarası">
          <div style={{ display:'grid', gridTemplateColumns:'minmax(72px,auto) 1fr', gap:8 }}>
            <input value="+90" disabled readOnly style={{ ...input, width:88, textAlign:'center', background:'#f7f7f7', color:'#555' }} />
            <input
              value={phoneNat10}
              readOnly
              disabled
              style={{ ...input, background:'#f7f7f7', color:'#555' }}
            />
          </div>
          <small style={{ color:'#666' }}>Telefon numaranızı değiştirmek için yetkilinize başvurun.</small>
        </Field>

        <div style={{ marginTop: 8, fontWeight: 700, color: '#007b55' }}>Şifreyi Değiştir (opsiyonel)</div>
        <Field label="Yeni Şifre">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Yeni şifre" style={input} />
        </Field>
        <Field label="Yeni Şifre (Tekrar)">
          <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="Yeni şifre tekrar" style={input} />
        </Field>

        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" disabled={saving} onClick={() => router.back()} style={btnGhost}>
            Geri Dön
          </button>
        </div>
      </form>
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      {children}
    </label>
  )
}

const input = { padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, outline: 'none' }
const btnPrimary = { background: '#007b55', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }
const btnGhost   = { background: '#fff', color: '#333', border: '1px solid #ccc', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }
