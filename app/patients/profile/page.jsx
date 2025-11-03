'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Telefon biçimlendirme (ileride lazım olabilir) */
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
  const [showPw1, setShowPw1] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const fullName = `${firstName}`.trim() + (lastName ? ` ${lastName}` : '')

  // Kullanıcı bilgilerini Auth + profiles üzerinden oku
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single()

      const f = prof?.first_name ?? user.user_metadata?.first_name ?? ''
      const l = prof?.last_name  ?? user.user_metadata?.last_name  ?? ''
      const p = user.phone || '' // auth.users.phone

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

      const upd = {
        data: { first_name: firstName, last_name: lastName, full_name: fullName }
      }
      if (password) upd.password = password

      const { error } = await supabase.auth.updateUser(upd)
      if (error) throw error

      setMsg('Bilgileriniz güncellendi ✅')
      setPassword(''); setPassword2('')
      setShowPw1(false); setShowPw2(false)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="pf-wrap" style={{ padding: 16 }}>Yükleniyor…</main>

  return (
    <main className="pf-wrap">
      <h2 className="pf-title">Bilgilerimi Görüntüle / Güncelle</h2>

      {msg && (
        <div className="pf-alert pf-alert-ok" role="status" aria-live="polite">
          {msg}
        </div>
      )}
      {err && (
        <div className="pf-alert pf-alert-err" role="alert" aria-live="assertive">
          Hata: {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="pf-form">
        <Field label="İsim">
          <input
            value={firstName}
            disabled
            readOnly
            className="pf-input pf-input-readonly"
            inputMode="text"
            autoComplete="given-name"
          />
        </Field>

        <Field label="Soyisim">
          <input
            value={lastName}
            disabled
            readOnly
            className="pf-input pf-input-readonly"
            inputMode="text"
            autoComplete="family-name"
          />
        </Field>

        <Field label="Telefon Numarası">
          <div className="pf-phone-grid">
            <input value="+90" disabled readOnly className="pf-input pf-input-readonly pf-cc" />
            <input
              value={phoneNat10}
              readOnly
              disabled
              className="pf-input pf-input-readonly"
              inputMode="numeric"
              autoComplete="tel"
            />
          </div>
          <small className="pf-muted">Telefon numaranızı değiştirmek için yetkilinize başvurun.</small>
        </Field>

        <div className="pf-section">Şifreyi Değiştir (opsiyonel)</div>

        <Field label="Yeni Şifre">
          <div className="pf-password">
            <input
              type={showPw1 ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Yeni şifre"
              className="pf-input"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw1(v => !v)}
              className="pf-eye"
              aria-label={showPw1 ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >{showPw1 ? '🙈' : '👁️'}</button>
          </div>
        </Field>

        <Field label="Yeni Şifre (Tekrar)">
          <div className="pf-password">
            <input
              type={showPw2 ? 'text' : 'password'}
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              placeholder="Yeni şifre tekrar"
              className="pf-input"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw2(v => !v)}
              className="pf-eye"
              aria-label={showPw2 ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >{showPw2 ? '🙈' : '👁️'}</button>
          </div>
        </Field>

        <div className="pf-actions">
          <button type="submit" disabled={saving} className="pf-btn pf-btn-primary">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" disabled={saving} onClick={() => router.back()} className="pf-btn pf-btn-ghost">
            Geri Dön
          </button>
        </div>
      </form>

      {/* ===== Responsive Styles ===== */}
      <style jsx global>{`
        :root {
          --pf-green: #007b55;
          --pf-border: #ddd;
          --pf-muted: #666;
        }

        .pf-wrap {
          max-width: 640px;
          margin: 16px auto;
          padding: 0 12px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          color: #111;
          background: #fff;
        }

        .pf-title {
          border-bottom: 2px solid var(--pf-green);
          padding-bottom: 6px;
          margin: 0 0 12px 0;
          font-size: 20px;
          text-wrap: balance;
        }

        .pf-alert {
          margin-top: 12px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          font-size: 14px;
        }
        .pf-alert-ok  { color: #0a7; background:#e9fbf6; border-color:#b8efe3; }
        .pf-alert-err { color: crimson; background:#ffeaea; border-color:#ffcccc; }

        .pf-form {
          margin-top: 16px;
          display: grid;
          gap: 14px;
        }

        .pf-field { display: grid; gap: 6px; }
        .pf-label { font-size: 14px; }

        .pf-input {
          padding: 12px;
          border: 1px solid var(--pf-border);
          border-radius: 10px;
          outline: none;
          min-height: 44px;          /* dokunma alanı */
          font-size: 15px;
          background: #fff;
        }
        .pf-input:focus { border-color: var(--pf-green); box-shadow: 0 0 0 3px rgba(0,123,85,.12); }
        .pf-input-readonly { background:#f7f7f7; color:#555; }

        .pf-muted { color: var(--pf-muted); font-size: 12px; margin-top: 6px; }

        .pf-phone-grid {
          display: grid;
          grid-template-columns: minmax(78px,auto) 1fr;
          gap: 8px;
          align-items: center;
        }
        .pf-cc { width: 88px; text-align: center; }

        .pf-section {
          margin-top: 4px;
          font-weight: 800;
          color: var(--pf-green);
        }

        .pf-password { position: relative; }
        .pf-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          padding: 4px 6px;
          -webkit-tap-highlight-color: transparent;
        }

        .pf-actions {
          display: flex;
          gap: 12px;
          margin-top: 6px;
          flex-wrap: wrap;
        }

        .pf-btn {
          border-radius: 10px;
          padding: 12px 14px;
          min-height: 44px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--pf-border);
          background: #fff;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        .pf-btn[disabled] { opacity: .6; cursor: not-allowed; }
        .pf-btn-primary {
          background: var(--pf-green);
          color: #fff;
          border-color: var(--pf-green);
        }
        .pf-btn-ghost {
          background: #fff;
          color: #333;
        }

        /* ===== Breakpoints ===== */
        /* < 480px: tam genişlik, stacked butonlar */
        @media (max-width: 479px) {
          .pf-title { font-size: 18px; }
          .pf-actions .pf-btn { flex: 1 1 100%; }   /* butonlar alt alta tam genişlik */
          .pf-input { font-size: 16px; }           /* iOS zoom'u önlemek için 16px+ */
        }

        /* 480–767px: hafif ferahlık */
        @media (min-width: 480px) and (max-width: 767px) {
          .pf-actions .pf-btn { flex: 1 1 auto; }
        }

        /* >=768px: masaüstü */
        @media (min-width: 768px) {
          .pf-title { font-size: 22px; }
          @media (hover:none) and (pointer:coarse) {
  :global(body){ overflow:hidden; }
}

        }
      `}</style>
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
    </label>
  )
}
