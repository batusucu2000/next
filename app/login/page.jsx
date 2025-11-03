'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Yardımcılar */
const onlyDigits = (v = '') => (v.match(/\d/g) || []).join('')
const isEmail = (s = '') => s.includes('@') && /\S+@\S+\.\S+/.test(s)
const toNat10 = (raw = '') => {
  const d = onlyDigits(raw)
  return d.length >= 10 ? d.slice(-10) : d
}
const isNat10 = (v = '') => /^\d{10}$/.test(v)
const asE164TR = (nat10) => `+90${nat10}`

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await redirectByRole()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (error) { setErrorMsg(error.message); return }
    if (prof?.role === 'admin') router.replace('/admin')
    else router.replace('/patients')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    
    if (!password) {
      return setErrorMsg('Lütfen şifrenizi girin.')
    }

    const id = identifier.trim()
    let error
    setLoading(true)
    
    try {
      if (isEmail(id)) {
        ({ error } = await supabase.auth.signInWithPassword({ 
          email: id, 
          password 
        }))
      } else {
        const nat10 = toNat10(id)
        if (!isNat10(nat10)) {
          throw new Error('Lütfen geçerli bir telefon numarası girin (5xxxxxxxxx).')
        }
        ({ error } = await supabase.auth.signInWithPassword({ 
          phone: asE164TR(nat10), 
          password 
        }))
      }
      
      if (error) throw error
      await redirectByRole()
    } catch (err) {
      setErrorMsg(
        err.message === 'Invalid login credentials' 
          ? 'Telefon numarası/e-posta veya şifre hatalı.'
          : err.message || 'Giriş sırasında bir hata oluştu.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleIdentifierChange = (value) => {
    // Telefon numarası formatlama
    if (!isEmail(value)) {
      const digits = onlyDigits(value)
      if (digits.length <= 10) {
        // 5xx xxx xx xx formatı
        let formatted = digits
        if (digits.length > 3) formatted = `${digits.slice(0, 3)} ${digits.slice(3)}`
        if (digits.length > 6) formatted = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
        if (digits.length > 8) formatted = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`
        setIdentifier(formatted)
        return
      }
    }
    setIdentifier(value)
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
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main className="px-auth-main">
        <div className="px-auth-card">
          <div className="px-auth-header">
            <h1 className="px-auth-title">Hesabınıza Giriş Yapın</h1>
            <p className="px-auth-subtitle">
              Fizyoterapi hizmetlerinize erişmek için giriş yapın
            </p>
          </div>

          {/* HATA MESAJI */}
          {errorMsg && (
            <div className="px-alert px-alert-error">
              <span className="px-alert-icon">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* GİRİŞ FORMU */}
          <form onSubmit={handleLogin} className="px-form">
            <div className="px-form-group">
              <label className="px-form-label">
                Telefon
              </label>
              <input
                type="text"
                className="px-form-input"
                placeholder="5xx xxx xx xx"
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                autoComplete="username"
                required
                disabled={loading}
              />
              <div className="px-form-helper">
                10 haneli telefon numaranızı (5xxxxxxxxx) veya e-posta adresinizi girin
              </div>
            </div>

            <div className="px-form-group">
              <label className="px-form-label">
                Şifre
              </label>
              <input
                type="password"
                className="px-form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="px-auth-btn" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="px-spinner"></div>
                  Giriş Yapılıyor...
                </>
              ) : (
                <>
                  <span>🔐</span>
                  Giriş Yap
                </>
              )}
            </button>
          </form>

          {/* KAYIT LİNKİ */}
          <div className="px-auth-footer">
            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>
              Hesabınız yoksa?{' '}
              <button
                onClick={() => router.push('/register')}
                className="px-auth-link"
                disabled={loading}
              >
                Buradan kayıt olun
              </button>
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}