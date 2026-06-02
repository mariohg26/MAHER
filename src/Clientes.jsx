import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { clientesApi, miEmpresaId } from './lib/api'

const ROJO = '#c81019'

// Campos vacíos para un cliente nuevo
const CLIENTE_VACIO = {
  tipo_persona: 'sociedad',
  razon_social: '',
  nombre_comercial: '',
  nif: '',
  direccion: '',
  cp: '',
  ciudad: '',
  provincia: '',
  pais: 'ES',
  email: '',
  telefono: '',
  iban: '',
  forma_pago: '',
  plazo_pago: 30,
  notas: '',
}

export default function Clientes() {
  const clientes = useColeccion(clientesApi)
  const [editando, setEditando] = useState(null) // null = nadie; objeto = formulario abierto
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const lista = clientes.items.filter(c => {
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    return (
      (c.razon_social || '').toLowerCase().includes(t) ||
      (c.nif || '').toLowerCase().includes(t) ||
      (c.ciudad || '').toLowerCase().includes(t)
    )
  })

  function nuevoCliente() {
    setEditando({ ...CLIENTE_VACIO })
    setAviso(null)
  }

  function editarCliente(c) {
    setEditando({ ...c })
    setAviso(null)
  }

  async function guardar() {
    if (!editando.razon_social.trim()) {
      setAviso({ tipo: 'error', texto: 'El nombre / razón social es obligatorio' })
      return
    }
    setGuardando(true)
    setAviso(null)
    try {
      if (editando.id) {
        // Actualizar existente
        const { id, created_at, updated_at, empresa_id, ...cambios } = editando
        await clientes.actualizar(id, cambios)
        setAviso({ tipo: 'ok', texto: 'Cliente actualizado correctamente' })
      } else {
        // Crear nuevo: hay que poner el empresa_id
        const empresaId = await miEmpresaId()
        if (!empresaId) {
          setAviso({ tipo: 'error', texto: 'No se pudo identificar tu empresa. Cierra sesión y vuelve a entrar.' })
          setGuardando(false)
          return
        }
        const nuevo = { ...editando, empresa_id: empresaId }
        // plazo_pago a número
        nuevo.plazo_pago = parseInt(nuevo.plazo_pago) || 30
        await clientes.crear(nuevo)
        setAviso({ tipo: 'ok', texto: 'Cliente creado correctamente' })
      }
      setEditando(null)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(c) {
    if (!window.confirm(`¿Eliminar el cliente "${c.razon_social}"? Esta acción no se puede deshacer.`)) return
    try {
      await clientes.eliminar(c.id)
      setAviso({ tipo: 'ok', texto: 'Cliente eliminado' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al eliminar: ' + (e.message || e) })
    }
  }

  // ─── Formulario de alta/edición ───
  if (editando) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          {editando.id ? 'Editar cliente' : 'Nuevo cliente'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          Rellena los datos. Solo el nombre es obligatorio.
        </p>

        {aviso && <Aviso aviso={aviso} />}

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>
          <Campo label="Nombre / Razón social *">
            <input style={inputStyle} value={editando.razon_social}
              onChange={e => setEditando({ ...editando, razon_social: e.target.value })}
              placeholder="Ej: Distribuciones García SL" />
          </Campo>

          <div style={fila2}>
            <Campo label="Nombre comercial">
              <input style={inputStyle} value={editando.nombre_comercial || ''}
                onChange={e => setEditando({ ...editando, nombre_comercial: e.target.value })} />
            </Campo>
            <Campo label="NIF / CIF">
              <input style={inputStyle} value={editando.nif || ''}
                onChange={e => setEditando({ ...editando, nif: e.target.value })}
                placeholder="B12345678" />
            </Campo>
          </div>

          <Campo label="Dirección">
            <input style={inputStyle} value={editando.direccion || ''}
              onChange={e => setEditando({ ...editando, direccion: e.target.value })} />
          </Campo>

          <div style={fila3}>
            <Campo label="Código postal">
              <input style={inputStyle} value={editando.cp || ''}
                onChange={e => setEditando({ ...editando, cp: e.target.value })} />
            </Campo>
            <Campo label="Ciudad">
              <input style={inputStyle} value={editando.ciudad || ''}
                onChange={e => setEditando({ ...editando, ciudad: e.target.value })} />
            </Campo>
            <Campo label="Provincia">
              <input style={inputStyle} value={editando.provincia || ''}
                onChange={e => setEditando({ ...editando, provincia: e.target.value })} />
            </Campo>
          </div>

          <div style={fila2}>
            <Campo label="Email">
              <input style={inputStyle} type="email" value={editando.email || ''}
                onChange={e => setEditando({ ...editando, email: e.target.value })} />
            </Campo>
            <Campo label="Teléfono">
              <input style={inputStyle} value={editando.telefono || ''}
                onChange={e => setEditando({ ...editando, telefono: e.target.value })} />
            </Campo>
          </div>

          <Campo label="IBAN (para domiciliaciones)">
            <input style={inputStyle} value={editando.iban || ''}
              onChange={e => setEditando({ ...editando, iban: e.target.value })}
              placeholder="ES00 0000 0000 0000 0000 0000" />
          </Campo>

          <div style={fila2}>
            <Campo label="Forma de pago">
              <input style={inputStyle} value={editando.forma_pago || ''}
                onChange={e => setEditando({ ...editando, forma_pago: e.target.value })}
                placeholder="Transferencia, recibo…" />
            </Campo>
            <Campo label="Plazo de pago (días)">
              <input style={inputStyle} type="number" value={editando.plazo_pago ?? 30}
                onChange={e => setEditando({ ...editando, plazo_pago: e.target.value })} />
            </Campo>
          </div>

          <Campo label="Notas">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={editando.notas || ''}
              onChange={e => setEditando({ ...editando, notas: e.target.value })} />
          </Campo>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setEditando(null)} disabled={guardando}
              style={{ flex: 1, padding: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              style={{ flex: 2, padding: 14, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : '💾 Guardar cliente'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Lista de clientes ───
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Clientes</h2>
        <button onClick={nuevoCliente}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + Nuevo cliente
        </button>
      </div>

      {aviso && <Aviso aviso={aviso} />}

      <input style={{ ...inputStyle, marginBottom: 16 }} value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por nombre, NIF o ciudad…" />

      {clientes.cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando clientes…</div>
      ) : clientes.error ? (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 16, borderRadius: 10 }}>
          Error al cargar: {clientes.error}
        </div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px dashed #e5e7eb' }}>
          {busqueda ? 'No hay clientes que coincidan con la búsqueda.' : 'Aún no tienes clientes. Crea el primero con el botón de arriba.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{c.razon_social}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {c.nif && <span>{c.nif}</span>}
                  {c.nif && c.ciudad && <span> · </span>}
                  {c.ciudad && <span>{c.ciudad}</span>}
                </div>
                {(c.email || c.telefono) && (
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                    {c.email}{c.email && c.telefono ? ' · ' : ''}{c.telefono}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => editarCliente(c)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Editar
                </button>
                <button onClick={() => eliminar(c)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, color: '#9ca3af', fontSize: 13 }}>
        {lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───
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
      background: ok ? '#d1fae5' : '#fee2e2',
      color: ok ? '#065f46' : '#991b1b',
      border: `1.5px solid ${ok ? '#86efac' : '#fecaca'}`,
      borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14, fontWeight: 600,
    }}>
      {ok ? '✅ ' : '⚠️ '}{aviso.texto}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  border: '1.5px solid #e5e7eb',
  borderRadius: 10,
  padding: '11px 13px',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const fila2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const fila3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }
