import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

/* === LISTELEME === */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()

    let query = supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, phone, role, credits, credits_expires_at, created_at')
      .in('role', ['user', 'admin'])
      .order('created_at', { ascending: false })

    if (q) {
      const digits = q.replace(/\D+/g, '')
      const nat10 = digits.length >= 10 ? digits.slice(-10) : ''
      const like = `%${q}%`
      const ors = [
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`
      ]
      if (nat10) {
        ors.push(`phone.ilike.%${nat10}`)
        ors.push(`phone.ilike.+90${nat10}%`)
      }
      if (q.startsWith('+90')) ors.push(`phone.ilike.${q}%`)
      query = query.or(ors.join(','))
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, rows: data || [] })
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || 'Server error' }, { status: 500 })
  }
}

/* === OLUŞTUR (telefon+şifre) === */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      phone,
      password,
      first_name = '',
      last_name  = '',
      credits    = 0,
      role       = 'user',
    } = body

    if (!phone || !password) {
      return NextResponse.json({ ok:false, message:'phone ve password zorunlu' }, { status:400 })
    }

    const { data: udata, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { first_name, last_name }
    })
    if (e1) {
      return NextResponse.json({ ok:false, message:e1.message }, { status:400 })
    }
    const user = udata.user

    const { error: e2 } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          first_name,
          last_name,
          phone,
          credits: Number(credits || 0),
          role
        },
        { onConflict: 'id' }
      )
    if (e2) {
      return NextResponse.json({ ok:false, message:e2.message }, { status:400 })
    }

    return NextResponse.json({ ok:true, user: { id: user.id }, user_id: user.id })
  } catch (e) {
    return NextResponse.json({ ok:false, message:e.message || 'Server error' }, { status:500 })
  }
}

/* === GÜNCELLE (telefon / parola / metadata / opsiyonel profile sync) === */
export async function PATCH(req) {
  try {
    const { id, phone, password, metadata, profile_updates } = await req.json().catch(() => ({}))
    if (!id) return NextResponse.json({ ok:false, message:'id eksik' }, { status:400 })

    const authPayload = {}
    if (password) authPayload.password = password
    if (phone) {
      authPayload.phone = phone
      authPayload.phone_confirm = true
    }
    if (metadata && typeof metadata === 'object') {
      authPayload.user_metadata = metadata
    }

    if (Object.keys(authPayload).length) {
      const { error: eAuth } = await supabaseAdmin.auth.admin.updateUserById(id, authPayload)
      if (eAuth) return NextResponse.json({ ok:false, message:eAuth.message }, { status:400 })
    }

    if (profile_updates && typeof profile_updates === 'object' && Object.keys(profile_updates).length) {
      const { error: eProf } = await supabaseAdmin
        .from('profiles')
        .update(profile_updates)
        .eq('id', id)
      if (eProf) return NextResponse.json({ ok:false, message:eProf.message }, { status:400 })
    }

    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ ok:false, message:e.message || 'Server error' }, { status:500 })
  }
}

/* === SİL === */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ ok:false, message:'id eksik' }, { status:400 })

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ ok:false, message:error.message }, { status:400 })

    return NextResponse.json({ ok:true })
  } catch (e) {
    return NextResponse.json({ ok:false, message:e.message || 'Server error' }, { status:500 })
  }
}
