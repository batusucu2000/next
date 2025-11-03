import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const sr  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !sr) throw new Error('Missing SUPABASE envs')
  return createClient(url, sr, { auth: { persistSession:false } })
}

export async function GET(req: Request) {
  try {
    const admin = getAdmin()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()

    const { data: profs, error: e1 } = await admin
      .from('profiles')
      .select('id, first_name, last_name, phone, credits, role')
      .order('first_name', { ascending: true })
      .limit(1000)
    if (e1) throw e1

    const { data: ul, error: e2 } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (e2) throw e2

    const map = new Map<string, { email:string; phone:string }>()
    for (const u of ul.users || []) map.set(u.id, { email: u.email || '', phone: u.phone || '' })

    let rows = (profs||[]).map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name:  p.last_name,
      email: map.get(p.id)?.email || '',
      phone: p.phone || map.get(p.id)?.phone || '',
      credits: p.credits ?? 0,
      role: p.role || 'user',
    }))

    if (q) {
      const qq = q.toLowerCase()
      rows = rows.filter(r =>
        (r.first_name||'').toLowerCase().includes(qq) ||
        (r.last_name||'').toLowerCase().includes(qq) ||
        (r.email||'').toLowerCase().includes(qq) ||
        (r.phone||'').toLowerCase().includes(qq)
      )
    }

    return NextResponse.json({ ok:true, rows })
  } catch (e:any) {
    return NextResponse.json({ ok:false, message:e.message || String(e) }, { status:400 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAdmin()
    const { email, phone, password, profile } = await req.json()

    if (!password) throw new Error('password zorunlu')
    if (!email && !phone) throw new Error('email veya phone zorunlu')

    const { data: created, error: e1 } = await admin.auth.admin.createUser({
      email: email || undefined,
      phone: phone || undefined,
      password,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: { role: profile?.role || 'user' },
    })
    if (e1) throw e1
    const uid = created.user?.id
    if (!uid) throw new Error('user id alınamadı')

    const { error: e2 } = await admin.from('profiles').insert({
      id: uid,
      first_name: profile?.first_name || '',
      last_name:  profile?.last_name  || '',
      phone:      phone || null,
      credits:    profile?.credits ?? 0,
      role:       profile?.role || 'user',
    })
    if (e2) throw e2

    return NextResponse.json({ ok:true, id: uid })
  } catch (e:any) {
    return NextResponse.json({ ok:false, message:e.message || String(e) }, { status:400 })
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = getAdmin()
    const { id, email, phone, password, profile } = await req.json()
    if (!id) throw new Error('id zorunlu')

    const upd:any = {}
    if (email !== undefined && email !== null) upd.email = email
    if (phone !== undefined && phone !== null) upd.phone = phone
    if (password) upd.password = password
    if (profile?.role) upd.app_metadata = { role: profile.role }

    if (Object.keys(upd).length) {
      const { error: e1 } = await admin.auth.admin.updateUserById(id, upd)
      if (e1) throw e1
    }

    if (profile) {
      const { error: e2 } = await admin
        .from('profiles')
        .update({
          first_name: profile.first_name ?? undefined,
          last_name:  profile.last_name  ?? undefined,
          phone:      phone ?? undefined,
          credits:    profile.credits    ?? undefined,
          role:       profile.role       ?? undefined,
        })
        .eq('id', id)
      if (e2) throw e2
    }

    return NextResponse.json({ ok:true })
  } catch (e:any) {
    return NextResponse.json({ ok:false, message:e.message || String(e) }, { status:400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = getAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) throw new Error('id zorunlu')

    const { error: e1 } = await admin.auth.admin.deleteUser(id)
    if (e1) throw e1

    const { error: e2 } = await admin.from('profiles').delete().eq('id', id)
    if (e2) throw e2

    return NextResponse.json({ ok:true })
  } catch (e:any) {
    return NextResponse.json({ ok:false, message:e.message || String(e) }, { status:400 })
  }
}
