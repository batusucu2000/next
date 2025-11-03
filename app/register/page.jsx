'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Telefon yardımcıları */
const digits = (v = '') => (v.match(/\d/g) || []).join('')
const toNat10 = (raw = '') => {
  const d = digits(raw)
  return d.length >= 10 ? d.slice(-10) : d
}
const isNat10 = (v) => /^\d{10}$/.test(v || '')
const asE164TR = (nat10) => `+90${nat10}`

/* Güvenli JSON parse */
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Form alanları
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNat10, setPhoneNat10] = useState('')
  const [password, setPassword] = useState('')
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
    if (!lastName.trim()) return 'Soyisim zorunludur.'
    if (!isNat10(phoneNat10)) return 'Lütfen geçerli bir telefon numarası girin (5xxxxxxxxx).'
    if (!password || password.length < 6) return 'Şifre en az 6 karakter olmalı.'
    if (password !== password2) return 'Şifreler eşleşmiyor.'
    return ''
  }

  // WhatsApp OTP Gönder
  const startSignup = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    const validationError = validateStep1()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const phoneE164 = asE164TR(phoneNat10)

      // Kayıtlı mı kontrol et
      const checkResponse = await fetch('/api/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneE164 }),
      })
      const checkData = await parseJsonSafe(checkResponse)
      
      if (!checkResponse.ok) {
        throw new Error(checkData.error || 'Numara kontrolü başarısız.')
      }

      if (checkData?.exists === true) {
        setError('Bu telefon numarasıyla zaten bir hesap var. Lütfen giriş yapın.')
        setStep(1)
        setOtp('')
        return
      }

      // WhatsApp OTP gönder
      const response = await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneE164 })
      })
      const data = await parseJsonSafe(response)
      
      if (!response.ok) {
        throw new Error(data.error || 'Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.')
      }

      setMessage(`${phoneE164} numarasına WhatsApp ile doğrulama kodu gönderildi.`)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.')
      setStep(1)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  // Kodu Doğrula
  const verifyCode = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    
    if (!isNat10(phoneNat10)) {
      setError('Lütfen geçerli bir telefon numarası girin.')
      return
    }
    
    if (!otp || otp.length < 4) {
      setError('Lütfen gelen doğrulama kodunu girin.')
      return
    }

    setLoading(true)
    try {
      const phoneE164 = asE164TR(phoneNat10)

      // Kodu doğrula
      const response = await fetch('/api/wa/verify', {
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
      const data = await parseJsonSafe(response)

      if (!response.ok) {
        throw new Error(data.error || 'Doğrulama başarısız. Lütfen tekrar deneyin.')
      }

      // Mevcut hesap kontrolü
      if (data.existing === true) {
        const { error: signError } = await supabase.auth.signInWithPassword({
          phone: phoneE164,
          password
        })
        
        if (signError) {
          setError('Bu telefon numarasıyla zaten bir hesap var. Şifreniz yanlış olabilir. Lütfen giriş sayfasından devam edin.')
          return
        }
        
        setMessage('Giriş başarılı. Yönlendiriliyorsunuz…')
        setTimeout(() => router.replace('/patients'), 1200)
        return
      }

      // Yeni kullanıcı girişi
      const { error: signError } = await supabase.auth.signInWithPassword({
        phone: phoneE164,
        password
      })
      
      if (signError) {
        throw new Error('Giriş başarısız. Lütfen şifrenizi kontrol edin.')
      }

      setMessage('Kayıt başarılı! Yönlendiriliyorsunuz…')
      setTimeout(() => router.replace('/patients'), 1200)
    } catch (err) {
      setError(err.message || 'Doğrulama sırasında bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  // Kodu Yeniden Gönder
  const resendCode = async () => {
    setMessage('')
    setError('')
    
    if (!isNat10(phoneNat10)) {
      setError('Lütfen geçerli bir telefon numarası girin.')
      return
    }
    
    setLoading(true)
    try {
      const phoneE164 = asE164TR(phoneNat10)
      const response = await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneE164 })
      })
      const data = await parseJsonSafe(response)
      
      if (!response.ok) {
        throw new Error(data.error || 'Kod gönderilemedi. Lütfen tekrar deneyin.')
      }
      
      setMessage('Doğrulama kodu WhatsApp ile tekrar gönderildi.')
    } catch (err) {
      setError(err.message || 'Kod gönderimi başarısız.')
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneDisplay = (phone) => {
    if (!phone) return ''
    return `+90 ${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`
  }

  return (
    <div className="px-auth-container">
      {/* ÜST BAR */}
      <header className="px-auth-header">
        <div className="px-auth-header-inner">
          <div className="px-brand">
            <span className="px-logo">Nil Sucu</span>
            <span className="px-sub">Fizyoterapi Kliniği</span>
          </div>
          <nav className="px-nav">
            <Link href="/login" className="px-btn" style={{ height: '40px' }}>
              Giriş Yap
            </Link>
          </nav>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main className="px-auth-main">
        <div className="px-auth-card">
          {/* ADIM GÖSTERGESİ */}
          <div className="px-step-indicator">
            <div className={`px-step ${step === 1 ? 'active' : ''}`}></div>
            <div className={`px-step ${step === 2 ? 'active' : ''}`}></div>
          </div>

          <div className="px-auth-header">
            <h1 className="px-auth-title">
              {step === 1 ? 'Hesap Oluşturun' : 'Kodu Doğrulayın'}
            </h1>
            <p className="px-auth-subtitle">
              {step === 1 
                ? 'Fizyoterapi hizmetlerimize erişmek için kayıt olun' 
                : 'WhatsApp ile gönderilen kodu girin'
              }
            </p>
          </div>

          {/* MESAJLAR */}
          {message && (
            <div className="px-alert" style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>
              <span className="px-alert-icon">✅</span>
              <span>{message}</span>
            </div>
          )}
          
          {error && (
            <div className="px-alert px-alert-error">
              <span className="px-alert-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* FORM ADIMLARI */}
          {step === 1 ? (
            <form onSubmit={startSignup} className="px-form">
              <div className="px-form-group">
                <label className="px-form-label">
                  İsim
                </label>
                <input
                  type="text"
                  className="px-form-input"
                  placeholder="Adınızı girin"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="px-form-group">
                <label className="px-form-label">
                  Soyisim
                </label>
                <input
                  type="text"
                  className="px-form-input"
                  placeholder="Soyadınızı girin"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="px-form-group">
                <label className="px-form-label">
                  Telefon Numarası
                </label>
                <div className="px-phone-group">
                  <div className="px-phone-prefix">+90</div>
                  <input
                    type="tel"
                    className="px-form-input"
                    placeholder="5xx xxx xx xx"
                    value={phoneNat10}
                    onChange={(e) => setPhoneNat10(toNat10(e.target.value))}
                    required
                    disabled={loading}
                    maxLength={10}
                  />
                </div>
                {!isNat10(phoneNat10) && phoneNat10 && (
                  <div className="px-form-helper" style={{ color: '#DC2626' }}>
                    Telefon numarası 10 haneli olmalı
                  </div>
                )}
              </div>

              <div className="px-form-group">
                <label className="px-form-label">
                  Şifre
                </label>
                <input
                  type="password"
                  className="px-form-input"
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <div className="px-form-helper">
                  Şifreniz en az 6 karakter uzunluğunda olmalı
                </div>
              </div>

              <div className="px-form-group">
                <label className="px-form-label">
                  Şifre Tekrar
                </label>
                <input
                  type="password"
                  className="px-form-input"
                  placeholder="Şifrenizi tekrar girin"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  disabled={loading}
                />
                {password2 && password !== password2 && (
                  <div className="px-form-helper" style={{ color: '#DC2626' }}>
                    Şifreler eşleşmiyor
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-auth-btn"
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
                {loading ? (
                  <>
                    <div className="px-spinner"></div>
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <span>📱</span>
                    Doğrulama Kodu Gönder
                  </>
                )}
              </button>

              {error.includes('hesap var') && (
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="px-auth-btn"
                  style={{ background: 'var(--panel)', color: 'var(--text)', border: '1.5px solid var(--line)' }}
                >
                  <span>🔐</span>
                  Giriş Yap Sayfasına Git
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={verifyCode} className="px-form">
              <div className="px-otp-container">
                <div className="px-otp-description">
                  Aşağıdaki numaraya WhatsApp ile doğrulama kodu gönderildi:
                </div>
                <div className="px-otp-phone">
                  {formatPhoneDisplay(phoneNat10)}
                </div>
                <div className="px-otp-description">
                  Lütfen gelen 6 haneli kodu aşağıya girin
                </div>
              </div>

              <div className="px-form-group">
                <label className="px-form-label">
                  Doğrulama Kodu
                </label>
                <input
                  type="text"
                  className="px-form-input px-otp-input"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(digits(e.target.value))}
                  required
                  disabled={loading}
                  maxLength={6}
                />
              </div>

              <div className="px-button-group">
                <button 
                  type="submit" 
                  className="px-auth-btn"
                  disabled={loading || !otp || otp.length < 4}
                >
                  {loading ? (
                    <>
                      <div className="px-spinner"></div>
                      Doğrulanıyor...
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      Doğrula ve Kayıt Ol
                    </>
                  )}
                </button>
                
                <button 
                  type="button" 
                  className="px-btn"
                  onClick={resendCode}
                  disabled={loading}
                  style={{ height: '52px', whiteSpace: 'nowrap' }}
                >
                  Kodu Tekrar Gönder
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-btn"
                style={{ 
                  width: '100%', 
                  background: 'transparent', 
                  border: '1.5px solid var(--line)',
                  marginTop: '12px'
                }}
                disabled={loading}
              >
                ↶ Telefon Numarasını Düzelt
              </button>
            </form>
          )}

          {/* ALT LİNK */}
          <div className="px-auth-footer">
            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>
              Zaten hesabınız var mı?{' '}
              <Link href="/login" className="px-auth-link">
                Giriş yapın
              </Link>
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}