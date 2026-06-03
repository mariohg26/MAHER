import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { presupuestosApi, facturasApi, clientesApi, miEmpresaId, siguienteNumeroFactura } from './lib/api'
import { abrirPDFFactura } from './lib/pdf'

const ROJO = '#c81019'
const HOY = new Date().toISOString().split('T')[0]

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—'

function calcTotales(doc) {
  const lineas = doc.lineas || []
  const base = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0)
  const iva = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0) * (Number(l.iva) || 0), 0)
  const irpf = base * (Number(doc.retencion_irpf) || 0)
  return { base, iva, irpf, total: base + iva - irpf }
}

const ESTADOS = {
  pendiente: { txt: 'Pendiente', bg: '#fef9c3', col: '#854d0e' },
  aceptado: { txt: 'Aceptado', bg: '#d1fae5', col: '#065f46' },
  rechazado: { txt: 'Rechazado', bg: '#fee2e2', col: '#991b1b' },
  facturado: { txt: 'Facturado', bg: '#ede9fe', col: '#5b21b6' },
}

export default function Presupuestos() {
  const presupuestos = useColeccion(presupuestosApi)
  const facturas = useColeccion(facturasApi)
  const clientes = useColeccion(clientesApi)
  const [doc, setDoc] = useState(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const getCliente = (id) => clientes.items.find(c => c.id === id)

  const lista = presupuestos.items
    .filter(p => filtro === 'todos' ? true : p.estado === filtro)
    .filter(p => {
      if (!busqueda) return true
      const t = busqueda.toLowerCase()
      const cli = getCliente(p.cliente_id)
      return String(p.id).toLowerCase().includes(t) || (cli?.razon_social || '').toLowerCase().includes(t)
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)))

  async function nuevo() {
    if (clientes.items.length === 0) {
      setAviso({ tipo: 'error', texto: 'Primero tienes que crear al menos un cliente.' })
      return
    }
    const c = clientes.items[0]
    setDoc({
      cliente_id: c.id,
      fecha: HOY,
      validez: '',
      estado: 'pendiente',
      retencion_irpf: c.retencion_irpf || 0,
      lineas: [{ desc: '', cant: 1, precio: 0, iva: 0.21 }],
    })
    setModoEdicion(false)
    setAviso(null)
  }

  function editar(p) {
    setDoc({ ...p, lineas: (p.lineas || []).map(l => ({ ...l })) })
    setModoEdicion(true)
    setAviso(null)
  }

  function addLinea() { setDoc({ ...doc, lineas: [...doc.lineas, { desc: '', cant: 1, precio: 0, iva: 0.21 }] }) }
  function quitarLinea(i) { setDoc({ ...doc, lineas: doc.lineas.filter((_, idx) => idx !== i) }) }
  function cambiarLinea(i, campo, valor) {
    setDoc({ ...doc, lineas: doc.lineas.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l) })
  }

  async function guardar() {
    if (!doc.cliente_id) { setAviso({ tipo: 'error', texto: 'Selecciona un cliente' }); return }
    if (doc.lineas.some(l => !l.desc || !l.desc.trim())) { setAviso({ tipo: 'error', texto: 'Falta la descripción en alguna línea' }); return }
    if (doc.lineas.some(l => !l.precio || l.precio <= 0)) { setAviso({ tipo: 'error', texto: 'Falta el precio en alguna línea' }); return }

    setGuardando(true)
    setAviso(null)
    try {
      const limpio = { ...doc }
      if (!limpio.validez) limpio.validez = null
      if (!limpio.fecha) limpio.fecha = null

      if (modoEdicion) {
        const { id, created_at, updated_at, empresa_id, creado_por, ...cambios } = limpio
        await presupuestos.actualizar(id, cambios)
        setAviso({ tipo: 'ok', texto: 'Presupuesto actualizado' })
      } else {
        const empresaId = await miEmpresaId()
        if (!empresaId) { setAviso({ tipo: 'error', texto: 'No se pudo identificar tu empresa.' }); setGuardando(false); return }
        const id = await siguienteNumeroFactura(empresaId, 'P')
        await presupuestos.crear({ ...limpio, id, empresa_id: empresaId })
        setAviso({ tipo: 'ok', texto: 'Presupuesto ' + id + ' creado' })
      }
      setDoc(null)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar el presupuesto ${p.id}?`)) return
    try { await presupuestos.eliminar(p.id); setAviso({ tipo: 'ok', texto: 'Presupuesto eliminado' }) }
    catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  async function cambiarEstado(p, estado) {
    try {
      await presupuestos.actualizar(p.id, { estado })
      setAviso({ tipo: 'ok', texto: 'Presupuesto ' + p.id + ' marcado como ' + ESTADOS[estado].txt.toLowerCase() })
    } catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  // ─── Convertir presupuesto en factura ───
  async function convertirEnFactura(p) {
    if (p.factura_id) { setAviso({ tipo: 'error', texto: 'Este presupuesto ya fue facturado (' + p.factura_id + ')' }); return }
    const cli = getCliente(p.cliente_id)
    const t = calcTotales(p)
    if (!window.confirm(`Convertir el presupuesto ${p.id} en factura.\n\nCliente: ${cli?.razon_social || '—'}\nImporte: ${fmt(t.total)}\n\nSe creará una factura nueva con estas líneas.`)) return
    try {
      const empresaId = await miEmpresaId()
      const facturaId = await siguienteNumeroFactura(empresaId, 'F')
      const nuevaFactura = {
        id: facturaId,
        empresa_id: empresaId,
        cliente_id: p.cliente_id,
        fecha: HOY,
        vencimiento: null,
        estado: 'pendiente',
        retencion_irpf: p.retencion_irpf || 0,
        cobrado_parcial: 0,
        lineas: (p.lineas || []).map(l => ({ ...l })),
      }
      await facturas.crear(nuevaFactura)
      // Marcar el presupuesto como facturado y enlazar
      await presupuestos.actualizar(p.id, { estado: 'facturado', factura_id: facturaId })
      setAviso({ tipo: 'ok', texto: '✅ Factura ' + facturaId + ' creada desde el presupuesto. Ya aparece en la pestaña Facturas.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al convertir: ' + (e.message || e) })
    }
  }

  function verPDF(p) {
    const cliente = getCliente(p.cliente_id)
    // Reutilizamos el PDF de factura, indicando que es presupuesto
    abrirPDFFactura({ ...p, vencimiento: p.validez, _tipo: 'PRESUPUESTO' }, cliente)
  }

  // ══════════════════ FORMULARIO ══════════════════
  if (doc) {
    const totales = calcTotales(doc)
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          {modoEdicion ? 'Editar presupuesto ' + doc.id : 'Nuevo presupuesto'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Rellena los datos y las líneas.</p>

        {aviso && <Aviso aviso={aviso} />}

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>
          <div style={fila2}>
            <Campo label="Cliente *">
              <select style={inputStyle} value={doc.cliente_id}
                onChange={e => {
                  const c = getCliente(e.target.value)
                  setDoc({ ...doc, cliente_id: e.target.value, retencion_irpf: c?.retencion_irpf ?? doc.retencion_irpf })
                }}>
                {clientes.items.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </Campo>
            <Campo label="Estado">
              <select style={inputStyle} value={doc.estado}
                onChange={e => setDoc({ ...doc, estado: e.target.value })}>
                <option value="pendiente">Pendiente</option>
                <option value="aceptado">Aceptado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </Campo>
          </div>

          <div style={fila2}>
            <Campo label="Fecha">
              <input style={inputStyle} type="date" value={doc.fecha || ''}
                onChange={e => setDoc({ ...doc, fecha: e.target.value })} />
            </Campo>
            <Campo label="Válido hasta">
              <input style={inputStyle} type="date" value={doc.validez || ''}
                onChange={e => setDoc({ ...doc, validez: e.target.value })} />
            </Campo>
          </div>

          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Líneas del presupuesto</label>
          </div>

          {doc.lineas.map((l, i) => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #f0f0f0' }}>
              <input style={{ ...inputStyle, marginBottom: 8 }} value={l.desc}
                placeholder="Descripción del producto/servicio"
                onChange={e => cambiarLinea(i, 'desc', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <CampoMini label="Cant.">
                  <input style={inputMini} type="number" step="any" value={l.cant}
                    onChange={e => cambiarLinea(i, 'cant', parseFloat(e.target.value) || 0)} />
                </CampoMini>
                <CampoMini label="Precio €">
                  <input style={inputMini} type="number" step="any" value={l.precio}
                    onChange={e => cambiarLinea(i, 'precio', parseFloat(e.target.value) || 0)} />
                </CampoMini>
                <CampoMini label="IVA">
                  <select style={inputMini} value={l.iva}
                    onChange={e => cambiarLinea(i, 'iva', parseFloat(e.target.value))}>
                    <option value="0.21">21%</option>
                    <option value="0.10">10%</option>
                    <option value="0.04">4%</option>
                    <option value="0">0%</option>
                  </select>
                </CampoMini>
                <button onClick={() => quitarLinea(i)} disabled={doc.lineas.length === 1}
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: doc.lineas.length === 1 ? 0.4 : 1 }}>✕</button>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                Subtotal: <strong>{fmt((l.cant || 0) * (l.precio || 0))}</strong>
              </div>
            </div>
          ))}

          <button onClick={addLinea}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px dashed #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
            + Añadir línea
          </button>

          <Campo label="Retención IRPF">
            <select style={inputStyle} value={doc.retencion_irpf}
              onChange={e => setDoc({ ...doc, retencion_irpf: parseFloat(e.target.value) })}>
              <option value="0">Sin retención (0%)</option>
              <option value="0.07">7%</option>
              <option value="0.15">15%</option>
              <option value="0.19">19%</option>
            </select>
          </Campo>

          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, marginTop: 8 }}>
            <FilaTotal label="Base imponible" valor={fmt(totales.base)} />
            <FilaTotal label="IVA" valor={fmt(totales.iva)} />
            {totales.irpf > 0 && <FilaTotal label={`Retención (${Math.round(doc.retencion_irpf * 100)}%)`} valor={'−' + fmt(totales.irpf)} rojo />}
            <div style={{ borderTop: '2px solid ' + ROJO, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, color: ROJO }}>
              <span>TOTAL</span><span>{fmt(totales.total)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setDoc(null)} disabled={guardando}
              style={{ flex: 1, padding: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              style={{ flex: 2, padding: 14, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : '💾 Guardar presupuesto'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════ LISTA ══════════════════
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Presupuestos</h2>
        <button onClick={nuevo}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + Nuevo presupuesto
        </button>
      </div>

      {aviso && <Aviso aviso={aviso} />}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['todos', 'pendiente', 'aceptado', 'rechazado', 'facturado'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: filtro === f ? 'none' : '1.5px solid #e5e7eb',
              background: filtro === f ? ROJO : '#fff',
              color: filtro === f ? '#fff' : '#6b7280',
            }}>
            {f === 'todos' ? 'Todos' : ESTADOS[f].txt}
          </button>
        ))}
      </div>

      <input style={{ ...inputStyle, marginBottom: 16 }} value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por número o cliente…" />

      {presupuestos.cargando || clientes.cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando…</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px dashed #e5e7eb' }}>
          {busqueda || filtro !== 'todos' ? 'No hay presupuestos que coincidan.' : 'Aún no tienes presupuestos. Crea el primero con el botón de arriba.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(p => {
            const cli = getCliente(p.cliente_id)
            const t = calcTotales(p)
            const est = ESTADOS[p.estado] || ESTADOS.pendiente
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{p.id}</span>
                      <span style={{ background: est.bg, color: est.col, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20 }}>{est.txt}</span>
                      {p.factura_id && <span style={{ background: '#ede9fe', color: '#5b21b6', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>→ {p.factura_id}</span>}
                    </div>
                    <div style={{ fontSize: 14, color: '#374151', marginTop: 4, fontWeight: 600 }}>{cli?.razon_social || '— cliente eliminado —'}</div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{fmtDate(p.fecha)}{p.validez ? ' · válido hasta ' + fmtDate(p.validez) : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: ROJO }}>{fmt(t.total)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Base {fmt(t.base)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <Btn onClick={() => verPDF(p)} bg="#eff6ff" col="#1e40af">📄 PDF</Btn>
                  <Btn onClick={() => editar(p)} bg="#f9fafb" col="#374151">✏️ Editar</Btn>
                  {p.estado === 'pendiente' && <Btn onClick={() => cambiarEstado(p, 'aceptado')} bg="#d1fae5" col="#065f46">✓ Aceptado</Btn>}
                  {p.estado === 'pendiente' && <Btn onClick={() => cambiarEstado(p, 'rechazado')} bg="#fef2f2" col="#991b1b">✕ Rechazado</Btn>}
                  {!p.factura_id && p.estado !== 'rechazado' && <Btn onClick={() => convertirEnFactura(p)} bg="#fff7ed" col="#9a3412">🧾 Convertir en factura</Btn>}
                  <Btn onClick={() => eliminar(p)} bg="#fef2f2" col="#991b1b">🗑️ Eliminar</Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, color: '#9ca3af', fontSize: 13 }}>
        {lista.length} {lista.length === 1 ? 'presupuesto' : 'presupuestos'}
      </div>
    </div>
  )
}

// ─── Auxiliares ───
function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
      {children}
    </div>
  )
}
function CampoMini({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  )
}
function FilaTotal({ label, valor, rojo }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14, color: rojo ? ROJO : '#4b5563' }}>
      <span>{label}</span><span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  )
}
function Btn({ onClick, bg, col, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: bg, color: col, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
      {children}
    </button>
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
const inputMini = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8,
  padding: '8px 10px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
const fila2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
