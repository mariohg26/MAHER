import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { proveedoresApi, miEmpresaId } from './lib/api'

const ROJO = '#c81019'

const PROVEEDOR_VACIO = {
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
  recargo_equiv: false,
  forma_pago: '',
  plazo_pago: 30,
  notas: '',
}

export default function Proveedores() {
  const proveedores = useColeccion(proveedoresApi)
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const lista = proveedores.items.filter(p => {
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    return (
      (p.razon_social || '').toLowerCase().includes(t) ||
      (p.nif || '').toLowerCase().includes(t) ||
      (p.ciudad || '').toLowerCase().includes(t)
    )
  })

  function nuevo() { setEditando({ ...PROVEEDOR_VACIO }); setAviso(null) }
  function editar(p) { setEditando({ ...p }); setAviso(null) }

  async function guardar() {
    if (!editando.razon_social.trim()) {
      setAviso({ tipo: 'error', texto: 'El nombre / razón social es obligatorio' })
      return
    }
    setGuardando(true)
    setAviso(null)
    try {
      if (editando.id) {
        const { id, created_at, updated_at, empresa_id, ...cambios } = editando
        await proveedores.actualizar(id, cambios)
        setAviso({ tipo: 'ok', texto: 'Proveedor actualizado correctamente' })
      } else {
        const empresaId = await miEmpresaId()
        if (!empresaId) {
          setAviso({ tipo: 'error', texto: 'No se pudo identificar tu empresa. Cierra sesión y vuelve a entrar.' })
          setGuardando(false)
          return
        }
        const nuevoReg = { ...editando, empresa_id: empresaId }
        nuevoReg.plazo_pago = parseInt(nuevoReg.plazo_pago) || 30
        await proveedores.crear(nuevoReg)
        setAviso({ tipo: 'ok', texto: 'Proveedor creado correctamente' })
      }
      setEditando(null)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar el proveedor "${p.razon_social}"? Esta acción no se puede deshacer.`)) return
    try {
      await proveedores.eliminar(p.id)
      setAviso({ tipo: 'ok', texto: 'Proveedor eliminado' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al eliminar: ' + (e.message || e) })
    }
  }

  if (editando) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          {editando.id ? 'Editar proveedor' : 'Nuevo proveedor'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          Rellena los datos. Solo el nombre es obligatorio.
        </p>

        {aviso && <Aviso aviso={aviso} />}

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>
          <Campo label="Nombre / Razón social *">
            <input style={inputStyle} value={editando.razon_social}
              onChange={e => setEditando({ ...editando, razon_social: e.target.value })}
              placeholder="Ej: Suministros Lácteos SA" />
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

          <Campo label="IBAN (para pagos)">
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

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              <input type="checkbox" checked={!!editando.recargo_equiv}
                onChange={e => setEditando({ ...editando, recargo_equiv: e.target.checked })}
                style={{ width: 18, height: 18 }} />
              Recargo de equivalencia
            </label>
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
              {guardando ? 'Guardando…' : '💾 Guardar proveedor'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Proveedores</h2>
        <button onClick={nuevo}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + Nuevo proveedor
        </button>
      </div>

      {aviso && <Aviso aviso={aviso} />}

      <input style={{ ...inputStyle, marginBottom: 16 }} value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por nombre, NIF o ciudad…" />

      {proveedores.cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando proveedores…</div>
      ) : proveedores.error ? (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 16, borderRadius: 10 }}>
          Error al cargar: {proveedores.error}
        </div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px dashed #e5e7eb' }}>
          {busqueda ? 'No hay proveedores que coincidan con la búsqueda.' : 'Aún no tienes proveedores. Crea el primero con el botón de arriba.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{p.razon_social}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {p.nif && <span>{p.nif}</span>}
                  {p.nif && p.ciudad && <span> · </span>}
                  {p.ciudad && <span>{p.ciudad}</span>}
                </div>
                {(p.email || p.telefono) && (
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                    {p.email}{p.email && p.telefono ? ' · ' : ''}{p.telefono}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => editar(p)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Editar
                </button>
                <button onClick={() => eliminar(p)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, color: '#9ca3af', fontSize: 13 }}>
        {lista.length} {lista.length === 1 ? 'proveedor' : 'proveedores'}
      </div>
    </div>
  )
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
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
  padding: '11px 13px', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const fila2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const fila3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }
