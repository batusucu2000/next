// app/api/check-phone/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'

// listUsers pagineli; 200'erli sayfa tarar
async function userExistsByPhone(phoneE164: string): Promise<boolean> {
  let page = 1
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw error
    const found = (data?.users || []).some(u => u.phone === phoneE164)
    if (found) return true
    if (!data?.users || data.users.length < 200) break
    page++
  }
  return false
}

export async function POST(req: Request) {
  try {
    const { phoneE164 } = await req.json() as { phoneE164: string }

    if (!/^\+\d{10,15}$/.test(phoneE164 || '')) {
      return NextResponse.json({ error: 'Geçersiz telefon formatı' }, { status: 400 })
    }

    const exists = await userExistsByPhone(phoneE164)
    return NextResponse.json({ exists })
  } catch (e: any) {
    console.error('check-phone fatal:', e)
    return NextResponse.json({ error: e?.message || 'Beklenmeyen hata' }, { status: 500 })
  }
}
