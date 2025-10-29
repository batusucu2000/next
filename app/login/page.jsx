'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* Yardımcılar */
const onlyDigits = (v='') => (v.match(/\d/g) || []).join('')
const isEmail = (s='') => s.includes('@') && /\S+@\S+\.\S+/.test(s)
const toNat10 = (raw='') => {
  const d = onlyDigits(raw)
  return d.length >= 10 ? d.slice(-10) : d
}
const isNat10 = (v='') => /^\d{10}$/.test(v)
const asE164TR = (nat10) => `+90${nat10}`

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('') // e-posta veya telefon
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState('')

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
    if (!password) return setErrorMsg('Şifre gerekli.')

    const id = identifier.trim()
    let error
    setLoading(true)
    try {
      if (isEmail(id)) {
        ({ error } = await supabase.auth.signInWithPassword({ email: id, password }))
      } else {
        const nat10 = toNat10(id)
        if (!isNat10(nat10)) {
          throw new Error('Telefon 10 hane olmalı (5xxxxxxxxx).')
        }
        ({ error } = await supabase.auth.signInWithPassword({ phone: asE164TR(nat10), password }))
      }
      if (error) throw error
      await redirectByRole()
    } catch (err) {
      setErrorMsg(err.message || 'Giriş başarısız.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* ÜST BAR */}
      <header className="px-topbar">
        <div className="px-brand">
          <span className="px-logo">Nil Sucu</span>
          <span className="px-sub">Giriş</span>
        </div>
      </header>

      {/* SAYFA */}
      <main className="px-landing" style={{ display:'grid', placeItems:'center' }}>
        <section className="px-card" style={{ width:'100%', maxWidth:420 }}>
          <h1 style={{ marginTop:0 }}>Giriş Yap</h1>

          {errorMsg && (
            <div style={{
              marginTop:10, background:'#ffe8e6', color:'#b71c1c',
              border:'1px solid #ffcccc', padding:'8px 10px', borderRadius:8, fontSize:14
            }}>
              Hata: {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="px-form">
            <label>
             Telefon
              <input
                type="text"
                placeholder="5xxxxxxxxx"
                value={identifier}
                onChange={(e)=>setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label>
              Şifre
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" className="px-btn px-primary" disabled={loading}>
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>

          <p style={{ marginTop:12, fontSize:13, color:'var(--muted)' }}>
            Hesabınız yok mu? Lütfen yöneticinizle iletişime geçin.
          </p>
        </section>
      </main>
    </div>
  )
}
