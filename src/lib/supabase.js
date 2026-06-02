import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────
// Claves de Supabase de Quesos Maher SL
// (la clave publicable es segura para estar aquí porque la
//  base de datos está protegida con Row Level Security)
// ─────────────────────────────────────────────────────────
const url = 'https://xpkmmkzrdwwbgitxuocl.supabase.co'
const key = 'sb_publishable_VdCNxsYG5vxxcLN-OyX3Ew_HExftVUT'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
