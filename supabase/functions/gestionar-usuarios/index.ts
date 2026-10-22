// ─────────────────────────────────────────────────────────
// Función de Supabase: gestionar usuarios de MAHER
//
// Solo la puede usar un administrador activo. Permite:
//   · crear un usuario ya confirmado (entra al momento, sin email)
//   · cambiar la contraseña de un usuario de tu empresa
//     (y de paso lo deja confirmado si no lo estaba)
//
// Usa la clave de servicio, que vive solo en el servidor de
// Supabase y nunca llega al navegador.
// ─────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROLES = ['admin', 'contable', 'comercial', 'lectura']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405)

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── ¿Quién llama? Tiene que ser un administrador activo ──
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: errUser } = await admin.auth.getUser(token)
    if (errUser || !user) return respuesta({ error: 'Tienes que iniciar sesión.' }, 401)

    const { data: yo } = await admin.from('usuarios').select('id, rol, empresa_id, activo').eq('id', user.id).single()
    if (!yo || yo.rol !== 'admin' || yo.activo === false) {
      return respuesta({ error: 'Solo un administrador puede gestionar usuarios.' }, 403)
    }

    const body = await req.json().catch(() => ({}))

    // ── Crear usuario ──
    if (body.accion === 'crear') {
      const email = String(body.email || '').trim().toLowerCase()
      const nombre = String(body.nombre || '').trim()
      const password = String(body.password || '')
      const rol = String(body.rol || 'comercial')
      if (!email || !nombre) return respuesta({ error: 'Faltan el nombre o el email.' }, 400)
      if (password.length < 6) return respuesta({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
      if (!ROLES.includes(rol)) return respuesta({ error: 'Rol no válido.' }, 400)

      const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre },
      })
      if (errCrear || !creado.user) {
        const yaExiste = /already|registered|exists/i.test(errCrear?.message || '')
        return respuesta({ error: yaExiste ? 'Ese email ya está registrado.' : 'No se pudo crear: ' + (errCrear?.message || '') }, 400)
      }

      const { data: ficha, error: errFicha } = await admin.from('usuarios').insert({
        id: creado.user.id, email, nombre, rol, empresa_id: yo.empresa_id, activo: true,
      }).select().single()
      if (errFicha) {
        // Deshacer para no dejar un acceso sin ficha
        await admin.auth.admin.deleteUser(creado.user.id)
        return respuesta({ error: 'No se pudo guardar la ficha: ' + errFicha.message }, 400)
      }
      return respuesta({ usuario: ficha })
    }

    // ── Cambiar contraseña ──
    if (body.accion === 'cambiar_password') {
      const id = String(body.id || '')
      const password = String(body.password || '')
      if (password.length < 6) return respuesta({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)

      const { data: otro } = await admin.from('usuarios').select('id, empresa_id').eq('id', id).single()
      if (!otro || otro.empresa_id !== yo.empresa_id) return respuesta({ error: 'Usuario no encontrado.' }, 404)

      const { error: errPass } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true })
      if (errPass) return respuesta({ error: 'No se pudo cambiar: ' + errPass.message }, 400)
      return respuesta({ ok: true })
    }

    return respuesta({ error: 'Acción no válida.' }, 400)
  } catch (e) {
    return respuesta({ error: 'Error inesperado: ' + ((e as Error).message || e) }, 500)
  }
})
