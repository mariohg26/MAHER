import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { gastosApi, proveedoresApi, miEmpresaId, subirAdjunto } from './lib/api'

const ROJO = '#c81019'
const HOY = new Date().toISOString().split('T')[0]

const CATEGORIAS = ['Suministros', 'Alquiler', 'Software/Suscripciones', 'Material de oficina', 'Transporte', 'Publicidad', 'Servicios profesionales', 'Seguros', 'Formación', 'Otros']

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—'

function calcTotales(g) {
  const lineas = g.lineas || []
  const base = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0)
  const iva = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0) * (Number(l.iva) || 0), 0)
  const irpf = base * (Number(g.retencion_irpf) || 0)
  return { base, iva, irpf, total: base + iva - irpf }
}

const GASTO_VACIO = {
  concepto: '',
  proveedor_id: '',
  fecha: HOY,
  categoria: 'Otros',
  deducible: true,
  retencion_irpf: 0,
  lineas: [{ desc: '', cant: 1, precio: 0, iva: 0.21 }],
  notas: '',
  adjunto_url: '',
}

export default function Gastos() {
  const gastos = useColeccion(gastosApi)
  const proveedores = useColeccion(proveedoresApi)
  const [doc, setDoc] = useState(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState('todas')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState(null)

  const getProv = (id) => proveedores.items.find(p => p.id === id)

  const lista = gastos.items
    .filter(g => filtroCat === 'todas' ? true : g.categoria === filtroCat)
    .filter(g => {
      if (!busqueda) return true
      const t = busqueda.toLowerCase()
      const prov = getProv(g.proveedor_id)
      return (g.concepto || '').toLowerCase().includes(t) || (prov?.razon_social || '').toLowerCase().includes(t)
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))

  function nuevo() { setDoc({ ...GASTO_VACIO, lineas: [{ desc: '', cant: 1, precio: 0, iva: 0.21 }] }); setModoEdicion(false); setAviso(null) }
  function editar(g) { setDoc({ ...g, lineas: (g.lineas || []).map(l => ({ ...l })) }); setModoEdicion(true); setAviso(null) }

  function addLinea() { setDoc({ ...doc, lineas: [...doc.lineas, { desc: '', cant: 1, precio: 0, iva: 0.21 }] }) }
  function quitarLinea(i) { setDoc({ ...doc, lineas: doc.lineas.filter((_, idx) => idx !== i) }) }
  function cambiarLinea(i, campo, valor) {
    setDoc({ ...doc, lineas: doc.lineas.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l) })
  }

  // ─── Subir adjunto ───
  async function onAdjuntar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setAviso({ tipo: 'error', texto: 'El archivo es demasiado grande (máximo 10 MB)' })
      return
    }
    setSubiendo(true)
    setAviso(null)
    try {
      const url = await subirAdjunto(file)
      setDoc({ ...doc, adjunto_url: url })
      setAviso({ tipo: 'ok', texto: 'Documento adjuntado correctamente' })
    } catch (err) {
      const msg = (err.message || '').includes('Bucket not found')
        ? 'Falta crear el almacén de adjuntos en Supabase (te explico cómo en el chat).'
        : 'Error al subir: ' + (err.message || err)
      setAviso({ tipo: 'error', texto: msg })
    } finally {
      setSubiendo(false)
    }
  }

  async function guardar() {
    if (!doc.concepto.trim()) { setAviso({ tipo: 'error', texto: 'El concepto es obligatorio' }); return }
    if (doc.lineas.some(l => !l.precio || l.precio <= 0)) { setAviso({ tipo: 'error', texto: 'Falta el importe en alguna línea' }); return }

    const avisos = []
    if (doc.categoria === 'Alquiler' && (!doc.retencion_irpf || doc.retencion_irpf === 0)) {
      avisos.push('Los alquileres suelen llevar retención del 19%. Revisa si corresponde.')
    }
    if (avisos.length > 0) {
      const ok = window.confirm('Aviso:\n\n' + avisos.join('\n\n') + '\n\n¿Guardar igualmente?')
      if (!ok) return
    }

    setGuardando(true)
    setAviso(null)
    try {
      const limpio = { ...doc }
      if (!limpio.proveedor_id) limpio.proveedor_id = null
      if (!limpio.fecha) limpio.fecha = null

      if (modoEdicion) {
        const { id, created_at, updated_at, empresa_id, creado_por, ...cambios } = limpio
        await gastos.actualizar(id, cambios)
        setAviso({ tipo: 'ok', texto: 'Gasto actualizado' })
      } else {
        const empresaId = await miEmpresaId()
        if (!empresaId) { setAviso({ tipo: 'error', texto: 'No se pudo identificar tu empresa.' }); setGuardando(false); return }
        await gastos.crear({ ...limpio, empresa_id: empresaId })
        setAviso({ tipo: 'ok', texto: 'Gasto creado' })
      }
      setDoc(null)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(g) {
    if (!window.confirm(`¿Eliminar el gasto "${g.concepto}"? Esta acción no se puede deshacer.`)) return
    try { await gastos.eliminar(g.id); setAviso({ tipo: 'ok', texto: 'Gasto eliminado' }) }
    catch (e) { setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) }) }
  }

  // ══════════════════ FORMULARIO ══════════════════
  if (doc) {
    const totales = calcTotales(doc)
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          {modoEdicion ? 'Editar gasto' : 'Nuevo gasto'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Registra el gasto y adjunta el ticket o factura si quieres.</p>

        {aviso && <Aviso aviso={aviso} />}

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>
          <Campo label="Concepto *">
            <input style={inputStyle} value={doc.concepto}
              onChange={e => setDoc({ ...doc, concepto: e.target.value })}
              placeholder="Ej: Material de oficina marzo" />
          </Campo>

          <div style={fila2}>
            <Campo label="Proveedor">
              <select style={inputStyle} value={doc.proveedor_id || ''}
                onChange={e => setDoc({ ...doc, proveedor_id: e.target.value })}>
                <option value="">— Sin proveedor —</option>
                {proveedores.items.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha">
              <input style={inputStyle} type="date" value={doc.fecha || ''}
                onChange={e => setDoc({ ...doc, fecha: e.target.value })} />
            </Campo>
          </div>

          <div style={fila2}>
            <Campo label="Categoría">
              <select style={inputStyle} value={doc.categoria}
                onChange={e => setDoc({ ...doc, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo label="Retención IRPF">
              <select style={inputStyle} value={doc.retencion_irpf}
                onChange={e => setDoc({ ...doc, retencion_irpf: parseFloat(e.target.value) })}>
                <option value="0">Sin retención (0%)</option>
                <option value="0.07">7%</option>
                <option value="0.15">15%</option>
                <option value="0.19">19% (alquileres)</option>
              </select>
            </Campo>
          </div>

          {/* Líneas */}
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Importes del gasto</label>
          </div>

          {doc.lineas.map((l, i) => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #f0f0f0' }}>
              <input style={{ ...inputStyle, marginBottom: 8 }} value={l.desc}
                placeholder="Descripción (opcional)"
                onChange={e => cambiarLinea(i, 'desc', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <CampoMini label="Cant.">
                  <input style={inputMini} type="number" step="any" value={l.cant}
                    onChange={e => cambiarLinea(i, 'cant', parseFloat(e.target.value) || 0)} />
                </CampoMini>
                <CampoMini label="Importe €">
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

          {/* Deducible */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              <input type="checkbox" checked={!!doc.deducible}
                onChange={e => setDoc({ ...doc, deducible: e.target.checked })}
                style={{ width: 18, height: 18 }} />
              Gasto deducible (cuenta para impuestos)
            </label>
          </div>

          {/* Adjunto */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Documento adjunto (ticket / factura)
            </label>
            {doc.adjunto_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: 12 }}>
                <span style={{ fontSize: 20 }}>📎</span>
                <a href={doc.adjunto_url} target="_blank" rel="noreferrer" style={{ flex: 1, color: '#065f46', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  Ver documento adjunto
                </a>
                <button onClick={() => setDoc({ ...doc, adjunto_url: '' })}
                  style={{ border: 'none', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Quitar
                </button>
              </div>
            ) : (
              <label style={{ display: 'block', border: '1.5px dashed #cbd5e1', borderRadius: 10, padding: 16, textAlign: 'center', cursor: subiendo ? 'wait' : 'pointer', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 14 }}>
                {subiendo ? '⏳ Subiendo…' : '📷 Subir foto o documento (JPG, PNG, PDF)'}
                <input type="file" accept="image/*,application/pdf" onChange={onAdjuntar} disabled={subiendo} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          <Campo label="Notas">
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={doc.notas || ''}
              onChange={e => setDoc({ ...doc, notas: e.target.value })} />
          </Campo>

          {/* Totales */}
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16 }}>
            <FilaTotal label="Base imponible" valor={fmt(totales.base)} />
            <FilaTotal label="IVA soportado" valor={fmt(totales.iva)} />
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
            <button onClick={guardar} disabled={guardando || subiendo}
              style={{ flex: 2, padding: 14, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: (guardando || subiendo) ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : '💾 Guardar gasto'}
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
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Gastos</h2>
        <button onClick={nuevo}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + Nuevo gasto
        </button>
      </div>

      {aviso && <Aviso aviso={aviso} />}

      <input style={{ ...inputStyle, marginBottom: 12 }} value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por concepto o proveedor…" />

      <div style={{ marginBottom: 16 }}>
        <select style={{ ...inputStyle, maxWidth: 280 }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {gastos.cargando || proveedores.cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando…</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px dashed #e5e7eb' }}>
          {busqueda || filtroCat !== 'todas' ? 'No hay gastos que coincidan.' : 'Aún no tienes gastos. Crea el primero con el botón de arriba.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(g => {
            const prov = getProv(g.proveedor_id)
            const t = calcTotales(g)
            return (
              <div key={g.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{g.concepto}</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{g.categoria}</span>
                      {!g.deducible && <span style={{ background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>No deducible</span>}
                      {g.adjunto_url && <span style={{ fontSize: 14 }} title="Tiene documento adjunto">📎</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                      {fmtDate(g.fecha)}{prov ? ' · ' + prov.razon_social : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: ROJO }}>{fmt(t.total)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Base {fmt(t.base)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  {g.adjunto_url && <Btn onClick={() => window.open(g.adjunto_url, '_blank')} bg="#eff6ff" col="#1e40af">📎 Ver adjunto</Btn>}
                  <Btn onClick={() => editar(g)} bg="#f9fafb" col="#374151">✏️ Editar</Btn>
                  <Btn onClick={() => eliminar(g)} bg="#fef2f2" col="#991b1b">🗑️ Eliminar</Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, color: '#9ca3af', fontSize: 13 }}>
        {lista.length} {lista.length === 1 ? 'gasto' : 'gastos'}
        {lista.length > 0 && <span> · Total base: <strong>{fmt(lista.reduce((s, g) => s + calcTotales(g).base, 0))}</strong></span>}
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
