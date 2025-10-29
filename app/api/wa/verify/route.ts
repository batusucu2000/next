// app/api/wa/verify/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'
import crypto from 'crypto'

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export async function POST(req: Request) {
  try {
    const { phoneE164, code, password, firstName, lastName } = (await req.json()) as {
      phoneE164: string; code: string; password: string; firstName?: string; lastName?: string
    }

    // -- basic validations --
    if (!/^\+\d{10,15}$/.test(phoneE164 || '')) {
      return NextResponse.json({ error: 'Geçersiz telefon' }, { status: 400 })
    }
    if (!/^\d{4,8}$/.test(code || '')) {
      return NextResponse.json({ error: 'Geçersiz kod' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Şifre en az 6 karakter' }, { status: 400 })
    }

    // -- 1) OTP kaydını doğrula --
    const { data: rows, error: qErr } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', phoneE164)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (qErr) return NextResponse.json({ error: `OTP sorgusu başarısız: ${qErr.message}` }, { status: 500 })
    if (!rows?.length) return NextResponse.json({ error: 'Kod bulunamadı, yeniden isteyin' }, { status: 400 })

    const otp = rows[0]
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Kodun süresi doldu' }, { status: 400 })
    }

    const match = otp.code_hash === sha256(code)
    const attempts = (otp.attempts ?? 0) + 1
    await supabaseAdmin.from('otp_codes').update({ used: match, attempts }).eq('id', otp.id)
    if (!match) return NextResponse.json({ error: 'Kod hatalı' }, { status: 400 })

    // -- 2) Bu telefon zaten kayıtlı mı? --
    const existingUserId = await getUserIdByPhone(phoneE164)
    if (existingUserId) {
      // Mevcut kullanıcı için KESİNLİKLE yeni user yaratma,
      // profili de burada zorlamıyoruz. Frontend login deneyecek.
      return NextResponse.json({ ok: true, existing: true })
    }

    // -- 3) Yeni kullanıcıyı oluştur ve telefonu confirmed yap --
    const created = await supabaseAdmin.auth.admin.createUser({
      phone: phoneE164,
      password,
      phone_confirm: true, // v2
      user_metadata: { first_name: firstName || '', last_name: lastName || '' }
    })
    const newUserId = created?.data?.user?.id
    if (!newUserId) {
      return NextResponse.json({ error: 'Kullanıcı oluşturulamadı' }, { status: 500 })
    }

    // -- 4) Profili upsert et --
    const { error: upErr } = await supabaseAdmin.from('profiles').upsert({
      id: newUserId,
      first_name: firstName || '',
      last_name: lastName || '',
      phone: phoneE164,
      role: 'user',
      credits: 0
    }, { onConflict: 'id' })

    if (upErr) return NextResponse.json({ error: `Profil güncellenemedi: ${upErr.message}` }, { status: 500 })

    return NextResponse.json({ ok: true, existing: false })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Beklenmeyen hata' }, { status: 500 })
  }
}

/** phone ile user id bul (Admin REST kısa yolu) */
async function getUserIdByPhone(phoneE164: string): Promise<string | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?phone=${encodeURIComponent(phoneE164)}&per_page=1`,
    {
      headers: {
        apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY as string}`,
      },
      cache: 'no-store',
    }
  )
  if (!res.ok) return null
  const arr = await res.json()
  const found = (Array.isArray(arr) ? arr : []).find((u: any) => u.phone === phoneE164)
  return found?.id ?? null
}
