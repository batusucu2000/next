// app/api/wa/send/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Twilio ve Supabase'i LAZY import et (import hatası build'i çökertmesin)
const lazy = {
  supabase: async () => (await import('@/lib/supabaseServer')).supabaseAdmin,
  twilio: async () => {
    const { twilioClient, WA_FROM } = await import('@/lib/twilioClient')
    return { twilioClient, WA_FROM }
  }
}

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export async function POST(req: Request) {
  try {
    const { phoneE164 } = (await req.json()) as { phoneE164: string }

    if (!/^\+\d{10,15}$/.test(phoneE164 || '')) {
      return NextResponse.json({ error: 'Geçersiz telefon formatı' }, { status: 400 })
    }

    // 1) Kod üret & DB'ye yaz
    const code = genCode()
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const supabaseAdmin = await lazy.supabase()
    const { error: dbErr } = await supabaseAdmin
      .from('otp_codes')
      .insert({ phone: phoneE164, code_hash: sha256(code), expires_at: expires })

    if (dbErr) {
      console.error('OTP insert error:', dbErr)
      return NextResponse.json({ error: `OTP kaydedilemedi: ${dbErr.message}` }, { status: 500 })
    }

    // 2) WhatsApp mesajını gönder
    const { twilioClient, WA_FROM } = await lazy.twilio()
    const body = `Doğrulama kodun: *${code}*\n\nSüre: 5 dk.\n\n- Nil Sucu`

    try {
      await twilioClient.messages.create({
        from: WA_FROM,                // sandbox: whatsapp:+14155238886
        to: `whatsapp:${phoneE164}`,  // alıcı
        body
      })
    } catch (twErr: any) {
      console.error('Twilio send error:', twErr)
      return NextResponse.json({ error: `WhatsApp gönderim hatası: ${twErr?.message || twErr}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('WA send fatal:', e)
    // Yanıt daima JSON olsun
    return NextResponse.json({ error: e?.message || 'Beklenmeyen hata' }, { status: 500 })
  }
}

// İzin verilmeyen methodlar da JSON dönsün
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
