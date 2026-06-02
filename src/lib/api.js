import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════
// CAPA DE ACCESO A DATOS
// Todas las funciones para leer/escribir en Supabase.
// Las políticas RLS de la BD garantizan que cada usuario solo accede
// a los datos de su empresa.
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────────────
export const auth = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async getUsuarioActual() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    // Traer datos extendidos del usuario (rol, empresa, etc.)
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .single()
    if (error) throw error
    // Actualizar last_login
    await supabase.from('usuarios').update({ last_login: new Date().toISOString() }).eq('id', user.id)
    return data
  },

  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => callback(session))
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  },
}

// ─────────────────────────────────────────────
// EMPRESA (configuración)
// ─────────────────────────────────────────────
export const empresaApi = {
  async get() {
    const { data, error } = await supabase.from('empresa').select('*').single()
    if (error) throw error
    return data
  },

  async update(id, cambios) {
    const { data, error } = await supabase
      .from('empresa')
      .update({ ...cambios, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ─────────────────────────────────────────────
// FACTORÍA GENÉRICA DE CRUD
// Genera funciones list/create/update/remove para una tabla
// ─────────────────────────────────────────────
function crudFactory(tabla, ordenarPor = 'created_at', asc = false) {
  return {
    async list() {
      const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .order(ordenarPor, { ascending: asc })
      if (error) throw error
      return data || []
    },

    async create(registro) {
      const { data, error } = await supabase
        .from(tabla)
        .insert(registro)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async update(id, cambios) {
      const { data, error } = await supabase
        .from(tabla)
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async remove(id) {
      const { error } = await supabase.from(tabla).delete().eq('id', id)
      if (error) throw error
    },
  }
}

// ─────────────────────────────────────────────
// APIS POR ENTIDAD
// ─────────────────────────────────────────────
export const clientesApi = crudFactory('clientes', 'razon_social', true)
export const proveedoresApi = crudFactory('proveedores', 'razon_social', true)
export const facturasApi = crudFactory('facturas', 'fecha', false)
export const presupuestosApi = crudFactory('presupuestos', 'fecha', false)
export const gastosApi = crudFactory('gastos', 'fecha', false)
export const tareasApi = crudFactory('tareas', 'fecha', true)
export const usuariosApi = crudFactory('usuarios', 'nombre', true)

// ─────────────────────────────────────────────
// HELPERS específicos
// ─────────────────────────────────────────────

// Obtener el empresa_id del usuario que ha iniciado sesión
export async function miEmpresaId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data?.empresa_id || null
}

// ─────────────────────────────────────────────
// ADJUNTOS (Supabase Storage) — para tickets/facturas de gastos
// ─────────────────────────────────────────────
const BUCKET = 'adjuntos'

// Sube un archivo y devuelve la URL pública
export async function subirAdjunto(file) {
  const ext = (file.name.split('.').pop() || 'dat').toLowerCase()
  const nombre = `gasto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(nombre, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre)
  return data.publicUrl
}


// Siguiente número de factura correlativo (F-2026-XXX)
export async function siguienteNumeroFactura(empresaId, prefijo = 'F', anio) {
  const year = anio || new Date().getFullYear()
  const { data, error } = await supabase
    .from('facturas')
    .select('id')
    .eq('empresa_id', empresaId)
    .like('id', `${prefijo}-${year}-%`)
  if (error) throw error
  let maxNum = 0
  ;(data || []).forEach(f => {
    const m = String(f.id).match(/(\d+)\s*$/)
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]))
  })
  const siguiente = String(maxNum + 1).padStart(3, '0')
  return `${prefijo}-${year}-${siguiente}`
}

// Crear un usuario nuevo (solo admin). Crea en Auth + en tabla usuarios.
// NOTA: requiere que el admin tenga permisos; en Supabase esto idealmente
// se hace con una Edge Function por seguridad. Versión simple aquí.
export async function crearUsuario({ email, password, nombre, rol, empresaId }) {
  // 1) Crear en Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError
  // 2) Crear en tabla usuarios
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      id: authData.user.id,
      email,
      nombre,
      rol,
      empresa_id: empresaId,
      activo: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
