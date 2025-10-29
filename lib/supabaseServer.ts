// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL eksik')
}
if (!serviceKey) {
  // Anon anahtarla giderse RLS takılır; bu yüzden fail-fast.
  throw new Error("SUPABASE_SERVICE_ROLE_KEY eksik (.env.local'a ekleyip dev'i yeniden başlat)")
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
})
