import { useState, useEffect } from 'react'
import { useColeccion } from './hooks/useColeccion'
import {
  empresaApi, usuariosApi, facturasApi, presupuestosApi,
  gastosApi, clientesApi, proveedoresApi, miEmpresaId, crearUsuario,
} from './lib/api'

const ROJO = '#c81019'

export default function Ajustes({ usuario }) {
  const [seccion, setSeccion] = useState('empresa')

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Ajustes</h2>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['empresa', '🏢 Datos de empresa'], ['backup', '💾 Copia de seguridad'], ['usuarios', '👥 Usuarios']].map(([id, label]) => (
          <button key={id} onClick={() => setSeccion(id)}
            style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: seccion === id ? 'none' : '1.5px solid #e5e7eb',
              background: seccion === id ? ROJO : '#fff',
              color: seccion === id ? '#fff' : '#6b7280',
            }}>{label}</button>
        ))}
      </div>

      {seccion === 'empresa' && <DatosEmpresa />}
      {seccion === 'backup' && <Backup />}
      {seccion === 'usuarios' && <Usuarios usuario={usuario} />}
    </div>
  )
}

// ══════════════════ DATOS DE EMPRESA ══════════════════
function DatosEmpresa() {
  const [empresa, setEmpresa] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    empresaApi.get()
      .then(e => { setEmpresa(e); setBorrador(e) })
      .catch(e => setAviso({ tipo: 'error', texto: 'Error al cargar: ' + (e.message || e) }))
      .finally(() => setCargando(false))
  }, [])

  const upd = (k, v) => setBorrador({ ...borrador, [k]: v })

  async function guardar() {
    if (!borrador.nombre?.trim()) { setAviso({ tipo: 'error', texto: 'El nombre fiscal es obligatorio' }); return }
    if (!borrador.nif?.trim()) { setAviso({ tipo: 'error', texto: 'El NIF/CIF es obligatorio' }); return }
    setGuardando(true)
    setAviso(null)
    try {
      const { id, created_at, updated_at, config, cuentas_bancarias, ...cambios } = borrador
      const actualizada = await empresaApi.update(empresa.id, cambios)
      setEmpresa(actualizada)
      setBorrador(actualizada)
      setAviso({ tipo: 'ok', texto: 'Datos guardados correctamente' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <Tarjeta><div style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>Cargando…</div></Tarjeta>
  if (!borrador) return <Tarjeta><div style={{ color: '#991b1b' }}>No se pudieron cargar los datos.</div></Tarjeta>

  return (
    <Tarjeta>
      {aviso && <Aviso aviso={aviso} />}
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Estos datos aparecen en tus facturas y presupuestos.</p>

      <Campo label="Nombre fiscal *">
        <input style={inputStyle} value={borrador.nombre || ''} onChange={e => upd('nombre', e.target.value)} />
      </Campo>
      <Campo label="NIF / CIF *">
        <input style={inputStyle} value={borrador.nif || ''} onChange={e => upd('nif', e.target.value)} />
      </Campo>
      <Campo label="Dirección">
        <input style={inputStyle} value={borrador.direccion || ''} onChange={e => upd('direccion', e.target.value)} />
      </Campo>
      <div style={fila2}>
        <Campo label="Código postal">
          <input style={inputStyle} value={borrador.cp || ''} onChange={e => upd('cp', e.target.value)} />
        </Campo>
        <Campo label="Ciudad">
          <input style={inputStyle} value={borrador.ciudad || ''} onChange={e => upd('ciudad', e.target.value)} />
        </Campo>
      </div>
      <div style={fila2}>
        <Campo label="Provincia">
          <input style={inputStyle} value={borrador.provincia || ''} onChange={e => upd('provincia', e.target.value)} />
        </Campo>
        <Campo label="Teléfono">
          <input style={inputStyle} value={borrador.telefono || ''} onChange={e => upd('telefono', e.target.value)} />
        </Campo>
      </div>
      <div style={fila2}>
        <Campo label="Email">
          <input style={inputStyle} value={borrador.email || ''} onChange={e => upd('email', e.target.value)} />
        </Campo>
        <Campo label="Web">
          <input style={inputStyle} value={borrador.web || ''} onChange={e => upd('web', e.target.value)} />
        </Campo>
      </div>
      <div style={fila2}>
        <Campo label="IBAN">
          <input style={inputStyle} value={borrador.iban || ''} onChange={e => upd('iban', e.target.value)} />
        </Campo>
        <Campo label="SWIFT / BIC">
          <input style={inputStyle} value={borrador.swift || ''} onChange={e => upd('swift', e.target.value)} />
        </Campo>
      </div>

      <button onClick={guardar} disabled={guardando}
        style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 8, opacity: guardando ? 0.6 : 1 }}>
        {guardando ? 'Guardando…' : '💾 Guardar datos'}
      </button>
    </Tarjeta>
  )
}

// ══════════════════ COPIA DE SEGURIDAD ══════════════════
function Backup() {
  const [aviso, setAviso] = useState(null)
  const [generando, setGenerando] = useState(false)

  async function exportar() {
    setGenerando(true)
    setAviso(null)
    try {
      const [empresa, facturas, presupuestos, gastos, clientes, proveedores] = await Promise.all([
        empresaApi.get(),
        facturasApi.list(),
        presupuestosApi.list(),
        gastosApi.list(),
        clientesApi.list(),
        proveedoresApi.list(),
      ])
      const data = { version: 1, fecha: new Date().toISOString(), empresa, facturas, presupuestos, gastos, clientes, proveedores }
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'backup_maher_' + new Date().toISOString().split('T')[0] + '.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setAviso({ tipo: 'ok', texto: 'Copia de seguridad descargada. Guárdala en un lugar seguro.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al generar la copia: ' + (e.message || e) })
    } finally {
      setGenerando(false)
    }
  }

  return (
    <Tarjeta>
      {aviso && <Aviso aviso={aviso} />}
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Descargar copia de seguridad</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
        Descarga todos tus datos (facturas, presupuestos, gastos, clientes y proveedores) en un archivo. Te recomendamos hacerlo de vez en cuando para tener una copia tuya guardada.
      </p>
      <button onClick={exportar} disabled={generando}
        style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: generando ? 0.6 : 1 }}>
        {generando ? 'Generando…' : '💾 Descargar copia de seguridad (JSON)'}
      </button>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12.5, color: '#1e40af', lineHeight: 1.5 }}>
        💡 Tus datos ya están guardados de forma segura en la nube (Supabase). Esta copia es un extra que te llevas tú, por si quieres tener tus propios respaldos.
      </div>
    </Tarjeta>
  )
}

// ══════════════════ USUARIOS ══════════════════
function Usuarios({ usuario }) {
  const usuarios = useColeccion(usuariosApi)
  const [form, setForm] = useState(null)
  const [creando, setCreando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const esAdmin = usuario?.rol === 'admin'

  async function crear() {
    if (!form.nombre.trim() || !form.email.trim() || !form.password) {
      setAviso({ tipo: 'error', texto: 'Rellena nombre, email y contraseña' }); return
    }
    if (form.password.length < 6) {
      setAviso({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres' }); return
    }
    setCreando(true)
    setAviso(null)
    try {
      const empresaId = await miEmpresaId()
      await crearUsuario({ email: form.email.trim(), password: form.password, nombre: form.nombre.trim(), rol: form.rol, empresaId })
      setAviso({ tipo: 'ok', texto: 'Usuario creado. Ya puede entrar con su email y contraseña.' })
      setForm(null)
      usuarios.recargar()
    } catch (e) {
      const msg = (e.message || '').includes('already registered') ? 'Ese email ya está registrado.' : 'Error: ' + (e.message || e)
      setAviso({ tipo: 'error', texto: msg })
    } finally {
      setCreando(false)
    }
  }

  return (
    <Tarjeta>
      {aviso && <Aviso aviso={aviso} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Usuarios de la empresa</h3>
        {esAdmin && !form && (
          <button onClick={() => setForm({ nombre: '', email: '', password: '', rol: 'empleado' })}
            style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {!esAdmin && <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>Solo los administradores pueden crear usuarios.</p>}

      {form && (
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #f0f0f0' }}>
          <Campo label="Nombre">
            <input style={inputStyle} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          </Campo>
          <Campo label="Email">
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </Campo>
          <Campo label="Contraseña (mínimo 6 caracteres)">
            <input style={inputStyle} type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </Campo>
          <Campo label="Rol">
            <select style={inputStyle} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </Campo>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setForm(null)} disabled={creando}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={crear} disabled={creando}
              style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: creando ? 0.6 : 1 }}>
              {creando ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}

      {usuarios.cargando ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.items.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f9fafb', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nombre} {u.id === usuario?.id && <span style={{ color: '#9ca3af', fontWeight: 500 }}>(tú)</span>}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{u.email}</div>
              </div>
              <span style={{ background: u.rol === 'admin' ? '#ede9fe' : '#f1f5f9', color: u.rol === 'admin' ? '#5b21b6' : '#475569', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                {u.rol === 'admin' ? 'Administrador' : 'Empleado'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}

// ─── Auxiliares ───
function Tarjeta({ children }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>{children}</div>
}
function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
      {children}
    </div>
  )
}
function Aviso({ aviso }) {
  const ok = aviso.tipo === 'ok'
  return (
    <div style={{
      background: ok ? '#d1fae5' : '#fee2e2', color: ok ? '#065f46' : '#991b1b',
      border: `1.5px solid ${ok ? '#86efac' : '#fecaca'}`,
      borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14, fontWeight: 600,
    }}>{ok ? '✅ ' : '⚠️ '}{aviso.texto}</div>
  )
}

const inputStyle = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
  padding: '11px 13px', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
const fila2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
