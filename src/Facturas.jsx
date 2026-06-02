import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { facturasApi, clientesApi, miEmpresaId, siguienteNumeroFactura } from './lib/api'
import { abrirPDFFactura } from './lib/pdf'

const ROJO = '#c81019'
const HOY = new Date().toISOString().split('T')[0]

// ─── Helpers de cálculo (idénticos a la app original) ───
const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—'

function calcTotales(doc) {
  const lineas = doc.lineas || []
  const base = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0)
  const iva = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0) * (Number(l.iva) || 0), 0)
  const irpf = base * (Number(doc.retencion_irpf) || 0)
  return { base, iva, irpf, total: base + iva - irpf }
}

const PAISES_UE = ['DE','FR','IT','PT','IE','NL','BE','AT','FI','GR','LU','MT','CY','DK','EE','HU','LV','LT','PL','CZ','RO','BG','HR','SI','SK','SE']

// Postgres no acepta '' en columnas DATE: hay que mandar null
function limpiarFechas(obj) {
  const o = { ...obj }
  if (!o.vencimiento) o.vencimiento = null
  if (!o.fecha) o.fecha = null
  return o
}

const ESTADOS = {
  pendiente: { txt: 'Pendiente', bg: '#fef9c3', col: '#854d0e' },
  cobrada: { txt: 'Cobrada', bg: '#d1fae5', col: '#065f46' },
  vencida: { txt: 'Vencida', bg: '#fee2e2', col: '#991b1b' },
}

export default function Facturas() {
  const facturas = useColeccion(facturasApi)
  const clientes = useColeccion(clientesApi)
  const [doc, setDoc] = useState(null)        // factura en edición (null = lista)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [cobroParcial, setCobroParcial] = useState(null) // {factura, importe}
  const [recordatorio, setRecordatorio] = useState(null)  // factura para recordar cobro

  const getCliente = (id) => clientes.items.find(c => c.id === id)

  const lista = facturas.items
    .filter(f => filtro === 'todas' ? true : f.estado === filtro)
    .filter(f => {
      if (!busqueda) return true
      const t = busqueda.toLowerCase()
      const cli = getCliente(f.cliente_id)
      return (
        String(f.id).toLowerCase().includes(t) ||
        (cli?.razon_social || '').toLowerCase().includes(t)
      )
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)))

  // ─── Abrir formulario de nueva factura ───
  async function nuevaFactura() {
    if (clientes.items.length === 0) {
      setAviso({ tipo: 'error', texto: 'Primero tienes que crear al menos un cliente (pestaña Clientes).' })
      return
    }
    const c = clientes.items[0]
    setDoc({
      cliente_id: c.id,
      fecha: HOY,
      vencimiento: '',
      estado: 'pendiente',
      retencion_irpf: c.retencion_irpf || 0,
      cobrado_parcial: 0,
      lineas: [{ desc: '', cant: 1, precio: 0, iva: 0.21 }],
    })
    setModoEdicion(false)
    setAviso(null)
  }

  function editarFactura(f) {
    setDoc({ ...f, lineas: (f.lineas || []).map(l => ({ ...l })) })
    setModoEdicion(true)
    setAviso(null)
  }

  // ─── Gestión de líneas ───
  function addLinea() {
    setDoc({ ...doc, lineas: [...doc.lineas, { desc: '', cant: 1, precio: 0, iva: 0.21 }] })
  }
  function quitarLinea(i) {
    setDoc({ ...doc, lineas: doc.lineas.filter((_, idx) => idx !== i) })
  }
  function cambiarLinea(i, campo, valor) {
    const lineas = doc.lineas.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l)
    setDoc({ ...doc, lineas })
  }

  // ─── Guardar (con validaciones fiscales) ───
  async function guardar() {
    if (!doc.cliente_id) { setAviso({ tipo: 'error', texto: 'Selecciona un cliente' }); return }
    if (doc.lineas.some(l => !l.desc || !l.desc.trim())) { setAviso({ tipo: 'error', texto: 'Falta la descripción en alguna línea' }); return }
    if (doc.lineas.some(l => !l.precio || l.precio <= 0)) { setAviso({ tipo: 'error', texto: 'Falta el precio en alguna línea (o es 0)' }); return }

    const cliente = getCliente(doc.cliente_id)
    const totales = calcTotales(doc)
    const avisos = []

    if (!cliente?.nif?.trim()) avisos.push('El cliente no tiene NIF/CIF. Las facturas sin NIF no son válidas fiscalmente.')

    if (!modoEdicion) {
      const mes = (doc.fecha || '').substring(0, 7)
      const dup = facturas.items.find(f => {
        if (f.cliente_id !== doc.cliente_id) return false
        if ((f.fecha || '').substring(0, 7) !== mes) return false
        return Math.abs(calcTotales(f).total - totales.total) < 0.01
      })
      if (dup) avisos.push(`Posible duplicado: ya existe la factura ${dup.id} del mismo cliente con importe ${fmt(totales.total)} este mes.`)
    }

    if (cliente && PAISES_UE.includes(cliente.pais) && doc.lineas.some(l => l.iva > 0)) {
      avisos.push('Cliente intracomunitario (UE) facturado con IVA. Si tiene VAT válido, debería ir sin IVA (inversión sujeto pasivo).')
    }
    if (doc.estado === 'pendiente' && !doc.vencimiento) {
      avisos.push('Factura pendiente sin fecha de vencimiento. Recomendado para control de cobros.')
    }

    if (avisos.length > 0) {
      const ok = window.confirm('Posibles incidencias:\n\n' + avisos.join('\n\n') + '\n\n¿Guardar igualmente?')
      if (!ok) return
    }

    setGuardando(true)
    setAviso(null)
    try {
      if (modoEdicion) {
        const { id, created_at, updated_at, empresa_id, creado_por, ...cambios } = doc
        await facturas.actualizar(id, limpiarFechas(cambios))
        setAviso({ tipo: 'ok', texto: 'Factura actualizada' })
      } else {
        const empresaId = await miEmpresaId()
        if (!empresaId) { setAviso({ tipo: 'error', texto: 'No se pudo identificar tu empresa.' }); setGuardando(false); return }
        const id = await siguienteNumeroFactura(empresaId, 'F')
        const nueva = limpiarFechas({ ...doc, id, empresa_id: empresaId })
        await facturas.crear(nueva)
        setAviso({ tipo: 'ok', texto: 'Factura ' + id + ' creada' })
      }
      setDoc(null)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(f) {
    if (!window.confirm(`¿Eliminar la factura ${f.id}? Esta acción no se puede deshacer.`)) return
    try { await facturas.eliminar(f.id); setAviso({ tipo: 'ok', texto: 'Factura eliminada' }) }
    catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  async function marcarCobrada(f) {
    try {
      const t = calcTotales(f)
      await facturas.actualizar(f.id, { estado: 'cobrada', cobrado_parcial: t.total })
      setAviso({ tipo: 'ok', texto: 'Factura ' + f.id + ' marcada como cobrada' })
    } catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  // ─── Duplicar ───
  async function duplicar(f) {
    if (!window.confirm(`Se creará una copia de ${f.id} con fecha de hoy y nuevo número.`)) return
    try {
      const empresaId = await miEmpresaId()
      const id = await siguienteNumeroFactura(empresaId, 'F')
      const nueva = {
        id, empresa_id: empresaId, cliente_id: f.cliente_id,
        fecha: HOY, vencimiento: null, estado: 'pendiente',
        retencion_irpf: f.retencion_irpf, cobrado_parcial: 0,
        lineas: (f.lineas || []).map(l => ({ ...l })),
      }
      await facturas.crear(nueva)
      setAviso({ tipo: 'ok', texto: 'Factura ' + id + ' creada (duplicado de ' + f.id + ')' })
    } catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  // ─── Rectificativa (líneas en negativo) ───
  async function rectificar(f) {
    const cli = getCliente(f.cliente_id)
    if (!window.confirm(`Se creará una factura RECTIFICATIVA con cantidades en negativo.\n\nOriginal: ${f.id}\nCliente: ${cli?.razon_social || '—'}\n\nLa rectificativa anula contablemente la original.`)) return
    try {
      const empresaId = await miEmpresaId()
      const id = await siguienteNumeroFactura(empresaId, 'R-F')
      const nueva = {
        id, empresa_id: empresaId, cliente_id: f.cliente_id,
        fecha: HOY, vencimiento: null, estado: 'pendiente',
        retencion_irpf: f.retencion_irpf, cobrado_parcial: 0,
        factura_rectificada: f.id,
        lineas: (f.lineas || []).map(l => ({ ...l, desc: 'RECTIFICACIÓN ' + f.id + ': ' + l.desc, cant: -Math.abs(l.cant) })),
      }
      await facturas.crear(nueva)
      setAviso({ tipo: 'ok', texto: 'Rectificativa ' + id + ' creada' })
    } catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  // ─── Cobro parcial ───
  async function aplicarCobroParcial() {
    const { factura, importe } = cobroParcial
    const imp = parseFloat(importe)
    if (isNaN(imp) || imp <= 0) { setAviso({ tipo: 'error', texto: 'Importe no válido' }); return }
    const t = calcTotales(factura)
    const yaCobrado = factura.cobrado_parcial || 0
    const nuevoCobrado = yaCobrado + imp
    try {
      if (nuevoCobrado >= t.total - 0.01) {
        await facturas.actualizar(factura.id, { estado: 'cobrada', cobrado_parcial: t.total })
        setAviso({ tipo: 'ok', texto: 'Factura ' + factura.id + ' cobrada por completo' })
      } else {
        await facturas.actualizar(factura.id, { cobrado_parcial: nuevoCobrado })
        setAviso({ tipo: 'ok', texto: `Cobro parcial registrado. Pendiente: ${fmt(t.total - nuevoCobrado)}` })
      }
      setCobroParcial(null)
    } catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  // ─── Ver PDF ───
  function verPDF(f) {
    const cliente = getCliente(f.cliente_id)
    abrirPDFFactura(f, cliente)
  }

  // ══════════════════ FORMULARIO ══════════════════
  if (doc) {
    const totales = calcTotales(doc)
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          {modoEdicion ? 'Editar factura ' + doc.id : 'Nueva factura'}
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
                <option value="cobrada">Cobrada</option>
                <option value="vencida">Vencida</option>
              </select>
            </Campo>
          </div>

          <div style={fila2}>
            <Campo label="Fecha emisión">
              <input style={inputStyle} type="date" value={doc.fecha || ''}
                onChange={e => setDoc({ ...doc, fecha: e.target.value })} />
            </Campo>
            <Campo label="Vencimiento">
              <input style={inputStyle} type="date" value={doc.vencimiento || ''}
                onChange={e => setDoc({ ...doc, vencimiento: e.target.value })} />
            </Campo>
          </div>

          {/* Líneas */}
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Líneas de la factura</label>
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
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: doc.lineas.length === 1 ? 0.4 : 1 }}>
                  ✕
                </button>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                Subtotal línea: <strong>{fmt((l.cant || 0) * (l.precio || 0))}</strong>
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

          {/* Totales */}
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, marginTop: 8 }}>
            <FilaTotal label="Base imponible" valor={fmt(totales.base)} />
            <FilaTotal label="IVA" valor={fmt(totales.iva)} />
            {totales.irpf > 0 && <FilaTotal label={`Retenciones (${Math.round(doc.retencion_irpf * 100)}%)`} valor={'−' + fmt(totales.irpf)} rojo />}
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
              {guardando ? 'Guardando…' : '💾 Guardar factura'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════ MODAL RECORDATORIO DE COBRO ══════════════════
  if (recordatorio) {
    return <RecordatorioCobro factura={recordatorio} cliente={getCliente(recordatorio.cliente_id)} onClose={() => setRecordatorio(null)} />
  }

  // ══════════════════ MODAL COBRO PARCIAL ══════════════════
  if (cobroParcial) {
    const t = calcTotales(cobroParcial.factura)
    const ya = cobroParcial.factura.cobrado_parcial || 0
    const pendiente = t.total - ya
    return (
      <div style={{ maxWidth: 460, margin: '40px auto', background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #f0f0f0' }}>
        <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>Registrar cobro · {cobroParcial.factura.id}</h3>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Total factura: <strong>{fmt(t.total)}</strong></div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Ya cobrado: <strong>{fmt(ya)}</strong></div>
        <div style={{ fontSize: 14, color: ROJO, marginBottom: 16 }}>Pendiente: <strong>{fmt(pendiente)}</strong></div>
        <Campo label="Importe que cobras ahora (€)">
          <input style={inputStyle} type="number" step="any" autoFocus value={cobroParcial.importe}
            onChange={e => setCobroParcial({ ...cobroParcial, importe: e.target.value })} />
        </Campo>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => setCobroParcial(null)}
            style={{ flex: 1, padding: 13, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={aplicarCobroParcial}
            style={{ flex: 1, padding: 13, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Registrar cobro</button>
        </div>
      </div>
    )
  }

  // ══════════════════ LISTA ══════════════════
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Facturas</h2>
        <button onClick={nuevaFactura}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + Nueva factura
        </button>
      </div>

      {aviso && <Aviso aviso={aviso} />}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['todas', 'pendiente', 'cobrada', 'vencida'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: filtro === f ? 'none' : '1.5px solid #e5e7eb',
              background: filtro === f ? ROJO : '#fff',
              color: filtro === f ? '#fff' : '#6b7280',
            }}>
            {f === 'todas' ? 'Todas' : ESTADOS[f].txt}
          </button>
        ))}
      </div>

      <input style={{ ...inputStyle, marginBottom: 16 }} value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por número o cliente…" />

      {facturas.cargando || clientes.cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando…</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px dashed #e5e7eb' }}>
          {busqueda || filtro !== 'todas' ? 'No hay facturas que coincidan.' : 'Aún no tienes facturas. Crea la primera con el botón de arriba.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(f => {
            const cli = getCliente(f.cliente_id)
            const t = calcTotales(f)
            const est = ESTADOS[f.estado] || ESTADOS.pendiente
            const ya = f.cobrado_parcial || 0
            const parcial = ya > 0 && f.estado !== 'cobrada'
            return (
              <div key={f.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{f.id}</span>
                      <span style={{ background: est.bg, color: est.col, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20 }}>{est.txt}</span>
                      {f.factura_rectificada && <span style={{ background: '#ede9fe', color: '#5b21b6', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>🔄 Rectificativa</span>}
                    </div>
                    <div style={{ fontSize: 14, color: '#374151', marginTop: 4, fontWeight: 600 }}>{cli?.razon_social || '— cliente eliminado —'}</div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{fmtDate(f.fecha)}{f.vencimiento ? ' · vence ' + fmtDate(f.vencimiento) : ''}</div>
                    {parcial && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 12, color: '#854d0e' }}>Cobrado {fmt(ya)} de {fmt(t.total)}</div>
                        <div style={{ height: 6, background: '#fef3c7', borderRadius: 4, marginTop: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: Math.min(100, (ya / t.total) * 100) + '%', background: '#f59e0b' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: ROJO }}>{fmt(t.total)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Base {fmt(t.base)}</div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <Btn onClick={() => verPDF(f)} bg="#eff6ff" col="#1e40af">📄 PDF</Btn>
                  <Btn onClick={() => editarFactura(f)} bg="#f9fafb" col="#374151">✏️ Editar</Btn>
                  {f.estado !== 'cobrada' && <Btn onClick={() => marcarCobrada(f)} bg="#d1fae5" col="#065f46">✓ Cobrada</Btn>}
                  {f.estado !== 'cobrada' && <Btn onClick={() => setCobroParcial({ factura: f, importe: '' })} bg="#fef9c3" col="#854d0e">💶 Cobro parcial</Btn>}
                  <Btn onClick={() => setRecordatorio(f)} bg="#dcfce7" col="#166534">💬 WhatsApp / Email</Btn>
                  <Btn onClick={() => duplicar(f)} bg="#ede9fe" col="#5b21b6">📋 Duplicar</Btn>
                  <Btn onClick={() => rectificar(f)} bg="#fff7ed" col="#9a3412">🔄 Rectificar</Btn>
                  <Btn onClick={() => eliminar(f)} bg="#fef2f2" col="#991b1b">🗑️ Eliminar</Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, color: '#9ca3af', fontSize: 13 }}>
        {lista.length} {lista.length === 1 ? 'factura' : 'facturas'}
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

// ─── Recordatorio de cobro por WhatsApp / Email ───
const EMPRESA_NOMBRE = 'Quesos Maher SL'
const EMPRESA_NIF = 'B37267259'

function RecordatorioCobro({ factura, cliente, onClose }) {
  const [tono, setTono] = useState('envio')   // envio | amable | firme | ultima
  const [canal, setCanal] = useState('whatsapp') // whatsapp | email
  const [copiado, setCopiado] = useState(false)

  const totales = calcTotales(factura)
  const diasVencido = factura.vencimiento
    ? Math.floor((new Date() - new Date(factura.vencimiento + 'T00:00:00')) / 86400000)
    : 0

  const nombreCli = cliente?.razon_social || ''

  const plantillas = {
    envio: {
      whatsapp: `Hola ${nombreCli}, te enviamos desde ${EMPRESA_NOMBRE} la factura nº ${factura.id} de fecha ${fmtDate(factura.fecha)} por importe de ${fmt(totales.total)}.\\n\\nSi necesitas cualquier aclaración, no dudes en contactarnos.\\n\\nMuchas gracias por tu confianza.\\nUn saludo,\\n${EMPRESA_NOMBRE}`,
      email: `Estimado/a cliente,\\n\\nLe adjuntamos la factura nº ${factura.id} de fecha ${fmtDate(factura.fecha)} por importe de ${fmt(totales.total)}.\\n\\nQuedamos a su disposición para cualquier aclaración.\\n\\nUn cordial saludo,\\n${EMPRESA_NOMBRE}\\nNIF: ${EMPRESA_NIF}`,
    },
    amable: {
      whatsapp: `Hola ${nombreCli}, te escribimos desde ${EMPRESA_NOMBRE} para recordarte que tienes pendiente la factura nº ${factura.id} de fecha ${fmtDate(factura.fecha)} por importe de ${fmt(totales.total)}.\n\nPor favor, confirma si la has recibido y cuándo podrás abonarla. Si ya has hecho el pago, ignora este mensaje.\n\nMuchas gracias.\nUn saludo,\n${EMPRESA_NOMBRE}`,
      email: `Estimado/a cliente,\n\nLe escribimos para recordarle que tiene pendiente la factura nº ${factura.id} de fecha ${fmtDate(factura.fecha)} por importe de ${fmt(totales.total)}.\n\nLe rogamos confirme la recepción y proceda al pago a la mayor brevedad. En caso de haberlo abonado ya, le rogamos disculpe este mensaje.\n\nUn cordial saludo,\n${EMPRESA_NOMBRE}\nNIF: ${EMPRESA_NIF}`,
    },
    firme: {
      whatsapp: `Hola ${nombreCli}, volvemos a contactarte respecto a la factura nº ${factura.id} por importe de ${fmt(totales.total)} con vencimiento del ${fmtDate(factura.vencimiento)}.\n\nLleva ${diasVencido} días vencida. ¿Puedes indicarnos cuándo podrás abonarla? Si hay algún problema, dínoslo y buscamos una solución.\n\nQuedamos a la espera de tu respuesta.\n${EMPRESA_NOMBRE}`,
      email: `Estimado/a cliente,\n\nNos ponemos en contacto de nuevo respecto a la factura nº ${factura.id} de ${fmtDate(factura.fecha)}, por importe de ${fmt(totales.total)}, vencida el ${fmtDate(factura.vencimiento)} (${diasVencido} días).\n\nLe rogamos contacte con nosotros para indicarnos cuándo podrá efectuar el pago o si necesita un plan de pago.\n\nUn cordial saludo,\n${EMPRESA_NOMBRE}`,
    },
    ultima: {
      whatsapp: `Hola, esta es una última comunicación respecto a la factura nº ${factura.id} de ${fmt(totales.total)} vencida hace ${diasVencido} días.\n\nNo hemos recibido respuesta a comunicaciones anteriores. Le rogamos contacte en los próximos 7 días o nos veremos obligados a iniciar acciones legales para el cobro de la deuda.\n\n${EMPRESA_NOMBRE}`,
      email: `Estimado/a cliente,\n\nLe remitimos esta comunicación formal respecto a la factura nº ${factura.id} de fecha ${fmtDate(factura.fecha)}, por importe de ${fmt(totales.total)}, vencida el ${fmtDate(factura.vencimiento)} (${diasVencido} días).\n\nHabiendo realizado comunicaciones previas sin respuesta, le comunicamos que si en el plazo de 7 días naturales no se procede al abono de la cantidad adeudada, nos veremos obligados a iniciar las acciones legales correspondientes para el cobro de la deuda, intereses de demora y costas, conforme a la Ley 3/2004 de lucha contra la morosidad.\n\nEsperamos no llegar a esta situación. Le rogamos contacte a la mayor brevedad.\n\nAtentamente,\n${EMPRESA_NOMBRE}\nNIF: ${EMPRESA_NIF}`,
    },
  }

  const mensaje = plantillas[tono][canal]

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch (e) {
      alert('No se pudo copiar automáticamente. Selecciónalo y cópialo a mano.')
    }
  }

  function abrirWhatsApp() {
    const tel = (cliente?.telefono || '').replace(/\D/g, '')
    const url = tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank')
  }

  function abrirEmail() {
    const email = cliente?.email || ''
    const asunto = `Factura pendiente nº ${factura.id}`
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`
  }

  const tonoBtn = (val, label, color) => (
    <button onClick={() => setTono(val)} style={{
      flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
      border: '1.5px solid ' + (tono === val ? color : '#e5e7eb'),
      background: tono === val ? color : '#fff',
      color: tono === val ? '#fff' : '#374151',
    }}>{label}</button>
  )
  const canalBtn = (val, label, color) => (
    <button onClick={() => setCanal(val)} style={{
      flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
      border: '1.5px solid ' + (canal === val ? color : '#e5e7eb'),
      background: canal === val ? color : '#fff',
      color: canal === val ? '#fff' : '#374151',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 600, margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>💬 Enviar / recordar por WhatsApp o email</h2>
        <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>← Volver</button>
      </div>

      <div style={{ background: '#fef3c7', padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
        <strong>{factura.id}</strong> · {nombreCli || '—'}<br />
        Importe: <strong>{fmt(totales.total)}</strong> · Vence: {fmtDate(factura.vencimiento)}
        {diasVencido > 0 && <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: 8 }}>· ¡{diasVencido} días vencida!</span>}
      </div>

      {!cliente?.telefono && canal === 'whatsapp' && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          Este cliente no tiene teléfono guardado. Se abrirá WhatsApp para que elijas el contacto.
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Tipo de mensaje</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {tonoBtn('envio', '📤 Enviar factura', '#1a56db')}
        {tonoBtn('amable', '🙂 Recordar (amable)', '#10b981')}
        {tonoBtn('firme', '😐 Firme', '#f59e0b')}
        {tonoBtn('ultima', '😠 Última', '#dc2626')}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Canal</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {canalBtn('whatsapp', '📱 WhatsApp', '#25d366')}
        {canalBtn('email', '📧 Email', '#1a56db')}
      </div>

      <textarea value={mensaje} readOnly rows={11}
        style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, background: '#fafafa', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={copiar} style={{ padding: 13, borderRadius: 10, border: 'none', background: '#1a56db', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {copiado ? '✓ Copiado' : '📋 Copiar mensaje'}
        </button>
        {canal === 'whatsapp' ? (
          <button onClick={abrirWhatsApp} style={{ padding: 13, borderRadius: 10, border: 'none', background: '#25d366', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>📱 Abrir WhatsApp</button>
        ) : (
          <button onClick={abrirEmail} style={{ padding: 13, borderRadius: 10, border: 'none', background: '#1a56db', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>📧 Abrir email</button>
        )}
      </div>

      <button onClick={() => abrirPDFFactura(factura, cliente)}
        style={{ width: '100%', marginTop: 10, padding: 13, borderRadius: 10, border: '1.5px solid #1e40af', background: '#eff6ff', color: '#1e40af', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
        📄 Abrir el PDF (para adjuntarlo)
      </button>

      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 10, marginTop: 10, fontSize: 12, color: '#075985', lineHeight: 1.5 }}>
        💡 <strong>Para enviar el PDF por WhatsApp:</strong> pulsa "Abrir WhatsApp" (se manda el texto), y luego adjunta el PDF descargándolo con el botón de arriba. WhatsApp no permite adjuntar archivos automáticamente por seguridad.
      </div>
    </div>
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
