// app/api/jobs/send-reminders/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

async function sendWhatsApp(toE164: string, body: string) {
  const { twilioClient, WA_FROM } = await import('@/lib/twilioClient')
  return twilioClient.messages.create({
    from: WA_FROM,                 // whatsapp:+14155238886 (sandbox) veya prod WA numaran
    to: `whatsapp:${toE164}`,
    body
  })
}

// Profilden E.164 telefon çek
async function fetchPhoneByUserId(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .limit(1)
    .single()
  if (error || !data) return null
  return (data.phone as string) || null
}

// İnsan-okur saat için slot_id -> İstanbul yerel string
function slotIdToIstReadable(slotId: string): string {
  // slot_id = 'YYYY-MM-DDTHH:MM'
  const [d, t] = String(slotId).split('T')
  // IST kabul ederek tarih oluştur ve TR-TR string üret
  return new Date(`${d}T${t}:00+03:00`).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const forceId = url.searchParams.get('id')      // tek kaydı zorla gönder
    const dry = url.searchParams.get('dry') === '1' // sadece önizleme, gönderme

    let rows: any[] = []
    let mode: 'auto' | 'force' = 'auto'

    if (forceId) {
      mode = 'force'
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('id, user_id, slot_id, status, reminder_at, reminder_sent_at')
        .eq('id', forceId)
        .limit(1)
      if (error) {
        return NextResponse.json({ error: `DB select failed: ${error.message}` }, { status: 500 })
      }
      rows = data || []
    } else {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('id, user_id, slot_id, status, reminder_at, reminder_sent_at')
        .is('reminder_sent_at', null)
        .not('reminder_at', 'is', null)
        .lte('reminder_at', nowIso)
        .eq('status', 'booked')
        .limit(200)
      if (error) {
        return NextResponse.json({ error: `DB select failed: ${error.message}` }, { status: 500 })
      }
      rows = (data || [])
    }

    if (!rows.length) {
      return NextResponse.json({ ok: true, mode, sent: 0, results: [] })
    }

    const results: any[] = []
    let sent = 0

    for (const row of rows) {
      const phone = await fetchPhoneByUserId(row.user_id as string)
      const validPhone = !!phone && /^\+\d{10,15}$/.test(phone!)
      const readableTime = slotIdToIstReadable(String(row.slot_id))

      const info: any = {
        id: row.id,
        status: row.status,
        phone,
        validPhone,
        reminder_at: row.reminder_at,
        reminder_sent_at: row.reminder_sent_at,
        readableTime
      }

      if (!validPhone) {
        info.skip = 'invalid-or-missing-phone'
        results.push(info)
        continue
      }

      const body =
`Merhaba 👋
Yarın için randevunuz bulunmaktadır.
Randevu zamanı: ${readableTime}

Herhangi bir değişiklik için lütfen bizimle iletişime geçin.
- Nil Sucu`

      if (dry) {
        info.preview = true
        info.body = body
        results.push(info)
        continue // dry modda KESİNLİKLE gönderme & DB güncelleme yapma
      }

      try {
        const tw = await sendWhatsApp(phone!, body)
        info.twilioSid = tw.sid

        const { error: upErr } = await supabaseAdmin
          .from('bookings')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', row.id)

        if (upErr) {
          info.updateError = upErr.message
        } else {
          info.markedSent = true
          sent++
        }
      } catch (twErr: any) {
        // Twilio hata bilgilerini anlaşılır şekilde döndür
        info.error = twErr?.message || String(twErr)
        info.errorCode = twErr?.code
        info.more = twErr?.moreInfo
      }

      results.push(info)
    }

    return NextResponse.json({ ok: true, mode, sent, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Beklenmeyen hata' }, { status: 500 })
  }
}
