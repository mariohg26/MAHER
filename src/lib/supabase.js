import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────
// Claves de Supabase de Quesos Maher SL
// (la clave publicable es segura para estar aquí porque la
//  base de datos está protegida con Row Level Security)
// ─────────────────────────────────────────────────────────
const url = 'https://xpkmmkzrdwwbgitxuocl.supabase.co'
const key = 'sb_publishable_VdCNxsYG5vxxcLN-OyX3Ew_HExftVUT'

export const SUPABASE_URL = url
export const SUPABASE_KEY = key

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Cliente secundario AISLADO: se usa para crear usuarios nuevos
// sin que la sesión del administrador actual se vea afectada.
// No guarda sesión ni refresca tokens.
export function clienteAislado() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
