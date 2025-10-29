'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Telefon yardımcıları */
const digits = (v='') => (v.match(/\d/g) || []).join('')
const toNat10 = (raw='') => {
  const d = digits(raw)
  return d.length >= 10 ? d.slice(-10) : d
}
const isNat10 = (v) => /^\d{10}$/.test(v || '')
const asE164TR = (nat10) => `+90${nat10}`

/* Güvenli JSON parse: yanıt JSON değilse bile hata vermez */
async function parseJsonSafe(r) {
  try {
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('application/json')) return await r.json()
    const txt = await r.text()
    return txt ? { error: txt } : {}
  } catch {
    return {}
  }
}

export default function RegisterPage() {
  const router = useRouter()

  const [step, setStep] = useState(1) // 1: form, 2: otp
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Form alanları
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phoneNat10, setPhoneNat10] = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [otp, setOtp] = useState('')

  // Girişli kullanıcıyı yönlendir
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.replace('/patients')
    })()
  }, [router])

  const validateStep1 = () => {
    if (!firstName.trim()) return 'İsim zorunludur.'
    if (!lastName.trim())  return 'Soyisim zorunludur.'
    if (!isNat10(phoneNat10)) return 'Telefon 10 hane olmalı (5xxxxxxxxx).'
    if (!password || password.length < 6) return 'Şifre en az 6 karakter olmalı.'
    if (password !== password2) return 'Şifreler eşleşmiyor.'
    return ''
  }

  // === WHATSAPP OTP GÖNDER ===
 const startSignup = async (e) => {
  e.preventDefault()
  setMsg(''); setErr('')
  const v = validateStep1()
  if (v) { setErr(v); return }

  setLoading(true)
  try {
    const phoneE164 = asE164TR(phoneNat10)

    // 1) Kayıtlı mı kontrol et
    const rCheck = await fetch('/api/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneE164 }),
    })
    const jCheck = await parseJsonSafe(rCheck)
    if (!rCheck.ok) throw new Error(jCheck.error || 'Numara kontrolü başarısız.')

    // DEFANSİF GUARD — burada karar veriyoruz
    if (jCheck?.exists === true) {
      setErr('Bu telefon numarasıyla zaten bir hesap var. Lütfen giriş yapın.')
      setStep(1)   // adımı zorla formda tut
      setOtp('')   // otp alanını sıfırla
      return       // <-- buradan kesin çık
    }

    // 2) WhatsApp OTP gönder
    const r = await fetch('/api/wa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneE164 })
    })
    const j = await parseJsonSafe(r)
    if (!r.ok) throw new Error(j.error || 'Kod gönderimi başarısız. Lütfen tekrar deneyin.')

    // OTP ekranına geçiş İZİNLİ
    setMsg(`${phoneE164} numarasına WhatsApp ile doğrulama kodu gönderildi.`)
    setStep(2)
  } catch (e) {
    setErr(e.message || String(e))
    // herhangi bir hata olursa da form adımında kal
    setStep(1)
    setOtp('')
  } finally {
    setLoading(false)
  }
}


  // === KODU DOĞRULA + KULLANICI OLUŞTUR/GİRİŞ ===
  const verifyCode = async (e) => {
  e.preventDefault()
  setMsg(''); setErr('')
  if (!isNat10(phoneNat10)) return setErr('Telefon 10 hane olmalı.')
  if (!otp || otp.length < 4) return setErr('Lütfen gelen doğrulama kodunu girin.')

  setLoading(true)
  try {
    const phoneE164 = asE164TR(phoneNat10)

    // 1) Kodu doğrula (ve server mevcut kullanıcıyı tespit etsin)
    const r = await fetch('/api/wa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneE164,
        code: otp,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim()
      })
    })
    const j = await parseJsonSafe(r)

    if (!r.ok) {
      throw new Error(j.error || 'Doğrulama başarısız. Lütfen tekrar deneyin.')
    }

    // 2) Telefon zaten kayıtlıysa kayıt gibi davranma → giriş dene
    if (j.existing === true) {
      // Mevcut hesaba giriş dene
      const { error: signErr } = await supabase.auth.signInWithPassword({
        phone: phoneE164,
        password
      })
      if (signErr) {
        // Şifre yanlışsa net mesaj ver ve giriş sayfasına yönlendir
        setErr('Bu telefon numarasıyla zaten bir hesap var. Şifren yanlış olabilir. Lütfen Giriş Yap ekranından devam et.')
        return
      }
      // Şifre doğruysa zaten kullanıcının kendi hesabıdır → yönlendir
      setMsg('Giriş başarılı. Yönlendiriliyorsunuz…')
      setTimeout(() => router.replace('/patients'), 1200)
      return
    }

    // 3) Yeni kullanıcı için normal giriş
    const { error: signErr } = await supabase.auth.signInWithPassword({
      phone: phoneE164,
      password
    })
    if (signErr) throw new Error('Giriş başarısız. Lütfen şifrenizi kontrol edin.')

    setMsg('Kayıt başarılı! Yönlendiriliyorsunuz…')
    setTimeout(() => router.replace('/patients'), 1200)
  } catch (e) {
    setErr(e.message || String(e))
  } finally {
    setLoading(false)
  }
}

  // === KODU YENİDEN GÖNDER ===
  const resendCode = async () => {
    setMsg(''); setErr('')
    if (!isNat10(phoneNat10)) return setErr('Telefon 10 hane olmalı.')
    setLoading(true)
    try {
      const phoneE164 = asE164TR(phoneNat10)
      const r = await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneE164 })
      })
      const j = await parseJsonSafe(r)
      if (!r.ok) throw new Error(j.error || 'Kod gönderilemedi. Lütfen tekrar deneyin.')
      setMsg('Doğrulama kodu WhatsApp ile tekrar gönderildi.')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <header className="px-topbar">
        <div className="px-brand">
          <span className="px-logo">Nil Sucu</span>
          <span className="px-sub">Kayıt</span>
        </div>
        <nav className="px-nav">
          <Link href="/login">Giriş Yap</Link>
        </nav>
      </header>

      <main className="px-landing" style={{ display:'grid', placeItems:'center' }}>
        <section className="px-card" style={{ width:'100%', maxWidth:520 }}>
          <h1 style={{ marginTop:0 }}>Kayıt Ol</h1>

          {msg && <div style={{ marginTop:10, color:'green', fontWeight:600 }}>{msg}</div>}
          {err && <div style={{ marginTop:10, color:'crimson', fontWeight:600 }}>{err}</div>}

          {step === 1 ? (
            <form onSubmit={startSignup} className="px-form">
              <label>
                İsim
                <input value={firstName} onChange={e=>setFirstName(e.target.value)} required />
              </label>

              <label>
                Soyisim
                <input value={lastName} onChange={e=>setLastName(e.target.value)} required />
              </label>

              <label>
                Telefon
                <div style={{ display:'grid', gridTemplateColumns:'72px 1fr', gap:8 }}>
                  <input value="+90" readOnly disabled
                    style={{ background:'#f6f7fb', color:'var(--muted)', textAlign:'center' }}/>
                  <input
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="5xxxxxxxxx"
                    value={phoneNat10}
                    onChange={(e)=>setPhoneNat10(toNat10(e.target.value))}
                    required
                  />
                </div>
                {!isNat10(phoneNat10) && phoneNat10 && (
                  <small style={{ color:'crimson' }}>10 hane olmalı</small>
                )}
              </label>

              <label>
                Şifre
                <input
                  type="password"
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  required
                  placeholder="En az 6 karakter"
                />
              </label>

              <label>
                Şifre (Tekrar)
                <input
                  type="password"
                  value={password2}
                  onChange={e=>setPassword2(e.target.value)}
                  required
                  placeholder="Şifreyi tekrar girin"
                />
                {password2 && password !== password2 && (
                  <small style={{ color:'crimson' }}>Şifreler eşleşmiyor.</small>
                )}
              </label>

              <button
                type="submit"
                className="px-btn px-primary"
                disabled={
                  loading ||
                  !isNat10(phoneNat10) ||
                  !firstName.trim() ||
                  !lastName.trim() ||
                  !password ||
                  password.length < 6 ||
                  password !== password2
                }
              >
                {loading ? 'Gönderiliyor…' : 'Devam Et'}
              </button>

              {/* Kayıtlı ise hızlı kısayol */}
              {err.includes('hesap var') && (
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="px-btn px-primary"
                  style={{ marginTop: 10 }}
                >
                  Giriş Yap
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={verifyCode} className="px-form">
              <div style={{ fontSize:14, color:'var(--muted)' }}>
                <b>+90 {phoneNat10.slice(0,3)} {phoneNat10.slice(3,6)} {phoneNat10.slice(6)}</b> numarasına gelen WhatsApp kodunu girin.
              </div>

              <label>
                Doğrulama Kodu
                <input
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="123456"
                  value={otp}
                  onChange={(e)=>setOtp(digits(e.target.value))}
                  required
                />
              </label>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button type="submit" className="px-btn px-primary" disabled={loading || !otp}>
                  {loading ? 'Doğrulanıyor…' : 'Doğrula ve Kayıt Ol'}
                </button>
                <button type="button" className="px-btn" disabled={loading} onClick={resendCode}>
                  Kodu Yeniden Gönder
                </button>
              </div>

              <button
                type="button"
                onClick={()=>setStep(1)}
                className="px-btn"
                style={{ background:'transparent', border:'1px solid var(--line)' }}
              >
                Telefonu düzelt
              </button>
            </form>
          )}

          <p style={{ marginTop:12, fontSize:13 }}>
            Zaten hesabın var mı? <Link href="/login">Giriş Yap</Link>
          </p>
        </section>
      </main>
    </div>
  )
}
