import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { facturasApi, gastosApi, clientesApi, presupuestosApi } from './lib/api'

const ROJO = '#c81019'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—'

function calcTotales(doc) {
  const lineas = doc.lineas || []
  const base = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0)
  const iva = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0) * (Number(l.iva) || 0), 0)
  const irpf = base * (Number(doc.retencion_irpf) || 0)
  return { base, iva, irpf, total: base + iva - irpf }
}

const WIDGETS = [
  { id: 'kpis', label: '📊 KPIs principales', def: true },
  { id: 'alertas', label: '🚨 Alertas inteligentes', def: true },
  { id: 'ultimasFacturas', label: '📄 Últimas facturas', def: true },
  { id: 'pendientesCobro', label: '⏳ Pendientes de cobro', def: true },
  { id: 'topClientes', label: '🏆 Top 5 clientes', def: false },
  { id: 'topGastos', label: '💸 Top 5 gastos por categoría', def: false },
  { id: 'comparativaMensual', label: '📈 Comparativa últimos 6 meses', def: false },
  { id: 'proximosVencs', label: '📆 Próximos vencimientos fiscales', def: false },
]

function leerWidgets() {
  try {
    const g = JSON.parse(localStorage.getItem('maher_widgets'))
    if (Array.isArray(g)) return g
  } catch (e) {}
  return WIDGETS.filter(w => w.def).map(w => w.id)
}

export default function Dashboard({ usuario, onNavegar }) {
  const facturasC = useColeccion(facturasApi)
  const gastosC = useColeccion(gastosApi)
  const clientesC = useColeccion(clientesApi)
  const presupuestosC = useColeccion(presupuestosApi)

  const [widgetsActivos, setWidgetsActivos] = useState(leerWidgets())
  const [configurando, setConfigurando] = useState(false)

  const facturas = facturasC.items
  const gastos = gastosC.items
  const clientes = clientesC.items

  const cargando = facturasC.cargando || gastosC.cargando || clientesC.cargando

  const getCliente = (id) => clientes.find(c => c.id === id)

  function toggleWidget(id) {
    const nuevos = widgetsActivos.includes(id) ? widgetsActivos.filter(x => x !== id) : [...widgetsActivos, id]
    setWidgetsActivos(nuevos)
    try { localStorage.setItem('maher_widgets', JSON.stringify(nuevos)) } catch (e) {}
  }

  const HOY_D = new Date()
  HOY_D.setHours(0, 0, 0, 0)
  const anoActual = HOY_D.getFullYear()
  const mesActual = HOY_D.getMonth()

  const facturasAno = facturas.filter(f => f.fecha && new Date(f.fecha).getFullYear() === anoActual)
  const gastosAno = gastos.filter(g => g.fecha && new Date(g.fecha).getFullYear() === anoActual)

  // ─── KPIs ───
  let ingresosBase = 0, ivaRep = 0, pendiente = 0, irpfRetenidoClientes = 0
  facturasAno.forEach(f => {
    const t = calcTotales(f)
    ingresosBase += t.base
    ivaRep += t.iva
    irpfRetenidoClientes += t.irpf
    if (f.estado === 'pendiente' || f.estado === 'vencida') {
      const cobradoYa = f.cobrado_parcial || 0
      pendiente += Math.max(0, t.total - cobradoYa)
    }
  })
  const gastosBase = gastosAno.filter(g => g.deducible).reduce((s, g) => s + calcTotales(g).base, 0)
  const gastosNoDed = gastosAno.filter(g => !g.deducible).reduce((s, g) => s + calcTotales(g).base, 0)
  const totalGastos = gastosBase + gastosNoDed
  const ivaSop = gastosAno.filter(g => g.deducible).reduce((s, g) => s + calcTotales(g).iva, 0)
  const resIVA = ivaRep - ivaSop
  const beneficio = ingresosBase - gastosBase
  const ingresos = ingresosBase

  // ─── ALERTAS ───
  const alertas = []
  const vencidas = facturas.filter(f => {
    if (f.estado !== 'pendiente' || !f.vencimiento) return false
    return new Date(f.vencimiento + 'T00:00:00') < HOY_D
  })
  if (vencidas.length > 0) {
    alertas.push({
      tipo: 'critico', icono: '🚨',
      titulo: `${vencidas.length} factura(s) vencida(s)`,
      texto: `Importe pendiente: ${fmt(vencidas.reduce((s, f) => s + calcTotales(f).total, 0))}`,
      accion: () => onNavegar('facturas'), botonLabel: 'Ver facturas',
    })
  }
  // Vencimiento fiscal próximo (15 días)
  const fechasFiscales = [
    { fecha: `${anoActual}-04-20`, label: 'Modelo 303/130 1T' },
    { fecha: `${anoActual}-07-20`, label: 'Modelo 303/130 2T' },
    { fecha: `${anoActual}-10-20`, label: 'Modelo 303/130 3T' },
    { fecha: `${anoActual + 1}-01-30`, label: 'Modelo 303/130 4T' },
    { fecha: `${anoActual + 1}-01-30`, label: 'Modelo 390' },
    { fecha: `${anoActual + 1}-02-28`, label: 'Modelo 347' },
  ]
  const proximos = fechasFiscales.filter(f => {
    const d = new Date(f.fecha + 'T00:00:00')
    const diff = (d - HOY_D) / 86400000
    return diff >= 0 && diff <= 15
  })
  if (proximos.length > 0) {
    alertas.push({
      tipo: 'alto', icono: '🏛️',
      titulo: `Vencimiento fiscal en ${Math.round((new Date(proximos[0].fecha + 'T00:00:00') - HOY_D) / 86400000)} días`,
      texto: proximos[0].label,
      accion: () => onNavegar('informes'), botonLabel: 'Ver informes',
    })
  }
  // Gasto disparado en categoría
  const gMesAct = gastos.filter(g => { const d = new Date(g.fecha); return d.getFullYear() === anoActual && d.getMonth() === mesActual })
  const gMesAnt = gastos.filter(g => {
    const d = new Date(g.fecha)
    const mesAnt = mesActual === 0 ? 11 : mesActual - 1
    const anoAnt = mesActual === 0 ? anoActual - 1 : anoActual
    return d.getFullYear() === anoAnt && d.getMonth() === mesAnt
  })
  const catAct = {}, catAnt = {}
  gMesAct.forEach(g => { catAct[g.categoria] = (catAct[g.categoria] || 0) + calcTotales(g).base })
  gMesAnt.forEach(g => { catAnt[g.categoria] = (catAnt[g.categoria] || 0) + calcTotales(g).base })
  Object.entries(catAct).forEach(([cat, imp]) => {
    const ant = catAnt[cat] || 0
    if (ant > 100 && imp > ant * 1.5 && alertas.length < 5) {
      alertas.push({
        tipo: 'medio', icono: '📈',
        titulo: `Gasto disparado en ${cat}`,
        texto: `Mes pasado: ${fmt(ant)} · Este mes: ${fmt(imp)} (+${Math.round((imp / ant - 1) * 100)}%)`,
        accion: () => onNavegar('gastos'), botonLabel: 'Ver gastos',
      })
    }
  })
  // Facturas +30 días vencidas
  const muyVencidas = facturas.filter(f => {
    if (f.estado !== 'pendiente' && f.estado !== 'vencida') return false
    if (!f.vencimiento) return false
    const dias = (HOY_D - new Date(f.vencimiento + 'T00:00:00')) / 86400000
    return dias >= 30
  })
  if (muyVencidas.length > 0) {
    alertas.push({
      tipo: 'critico', icono: '📨',
      titulo: `${muyVencidas.length} factura(s) +30 días vencida(s)`,
      texto: 'Considera enviar un recordatorio firme',
      accion: () => onNavegar('facturas'), botonLabel: 'Ver facturas',
    })
  }

  // ─── Top clientes ───
  const porCliente = {}
  facturasAno.forEach(f => { if (f.cliente_id) porCliente[f.cliente_id] = (porCliente[f.cliente_id] || 0) + calcTotales(f).total })
  const topClientes = Object.entries(porCliente)
    .map(([id, imp]) => ({ cliente: getCliente(id), importe: imp }))
    .filter(x => x.cliente)
    .sort((a, b) => b.importe - a.importe)
    .slice(0, 5)

  // ─── Top categorías de gasto ───
  const porCategoria = {}
  gastosAno.forEach(g => { porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + calcTotales(g).total })
  const topGastos = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ─── Comparativa 6 meses ───
  const ultimosMeses = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anoActual, mesActual - i, 1)
    const mes = d.getMonth(), ano = d.getFullYear()
    const ing = facturas.filter(f => { const fd = new Date(f.fecha); return fd.getFullYear() === ano && fd.getMonth() === mes }).reduce((s, f) => s + calcTotales(f).total, 0)
    const gas = gastos.filter(g => { const gd = new Date(g.fecha); return gd.getFullYear() === ano && gd.getMonth() === mes }).reduce((s, g) => s + calcTotales(g).total, 0)
    ultimosMeses.push({ label: d.toLocaleDateString('es-ES', { month: 'short' }), ingresos: ing, gastos: gas })
  }
  const maxMes = Math.max(...ultimosMeses.map(m => Math.max(m.ingresos, m.gastos)), 1)

  // ─── Pendientes de cobro ───
  const pendientesCobro = facturas.filter(f => f.estado === 'pendiente').sort((a, b) => {
    if (!a.vencimiento) return 1
    if (!b.vencimiento) return -1
    return a.vencimiento.localeCompare(b.vencimiento)
  }).slice(0, 5)

  if (cargando) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando tu resumen…</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>¡Hola, {usuario?.nombre || 'Mario'}! 👋</h2>
          <p style={{ color: '#6b7280', fontSize: 13 }}>Resumen del año {anoActual}</p>
        </div>
        <button onClick={() => setConfigurando(!configurando)}
          style={{ background: configurando ? ROJO : '#f3f4f6', color: configurando ? '#fff' : '#374151', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          {configurando ? '✓ Hecho' : '⚙️ Configurar'}
        </button>
      </div>

      {configurando && (
        <Card style={{ background: '#fef2f2', border: `2px solid ${ROJO}`, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Elige qué quieres ver en tu inicio:</div>
          {WIDGETS.map(w => (
            <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={widgetsActivos.includes(w.id)} onChange={() => toggleWidget(w.id)} style={{ width: 18, height: 18, accentColor: ROJO }} />
              <span style={{ fontSize: 14 }}>{w.label}</span>
            </label>
          ))}
        </Card>
      )}

      {/* KPIs */}
      {widgetsActivos.includes('kpis') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <KPI label="Ingresos (base)" value={fmt(ingresos)} accent="#1a56db" sub={`${facturasAno.length} factura(s)`} onClick={() => onNavegar('facturas')} />
          <KPI label="Gastos (base)" value={fmt(totalGastos)} accent="#ef4444" sub={`${gastosAno.length} gasto(s)`} onClick={() => onNavegar('gastos')} />
          <KPI label="Beneficio" value={fmt(beneficio)} accent={beneficio >= 0 ? '#059669' : '#dc2626'} sub="Antes de impuestos" />
          <KPI label="Pendiente cobro" value={fmt(pendiente)} accent="#f59e0b" sub={`${facturas.filter(f => f.estado === 'pendiente' || f.estado === 'vencida').length} factura(s)`} onClick={() => onNavegar('facturas')} />
          <KPI label="IVA" value={fmt(Math.abs(resIVA))} accent={resIVA >= 0 ? '#dc2626' : '#059669'} sub={resIVA >= 0 ? 'A ingresar' : 'A devolver'} />
          <KPI label="Retenciones recibidas" value={fmt(irpfRetenidoClientes)} accent="#5b21b6" sub="Ingresado por clientes" />
        </div>
      )}

      {/* ALERTAS */}
      {widgetsActivos.includes('alertas') && alertas.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>🚨 Alertas inteligentes</h4>
          {alertas.map((a, i) => {
            const colores = {
              critico: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
              alto: { bg: '#fed7aa', border: '#ea580c', text: '#9a3412' },
              medio: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
              info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
            }
            const c = colores[a.tipo]
            return (
              <div key={i} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.text, marginBottom: 2 }}>{a.icono} {a.titulo}</div>
                  <div style={{ fontSize: 12, color: c.text, opacity: 0.85 }}>{a.texto}</div>
                </div>
                {a.accion && <button onClick={a.accion} style={{ background: c.border, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.botonLabel}</button>}
              </div>
            )
          })}
        </Card>
      )}
      {widgetsActivos.includes('alertas') && alertas.length === 0 && (
        <Card style={{ marginBottom: 14, background: '#f0fdf4', border: '1.5px solid #86efac', textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>✨</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginTop: 6 }}>Todo en orden</div>
          <div style={{ fontSize: 11, color: '#065f46', opacity: 0.8 }}>No hay alertas pendientes</div>
        </Card>
      )}

      {/* PENDIENTES DE COBRO */}
      {widgetsActivos.includes('pendientesCobro') && pendientesCobro.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>⏳ Pendientes de cobro</h4>
          {pendientesCobro.map(f => {
            const t = calcTotales(f)
            const c = getCliente(f.cliente_id)
            const diasVenc = f.vencimiento ? Math.floor((HOY_D - new Date(f.vencimiento + 'T00:00:00')) / 86400000) : null
            const vencido = diasVenc > 0
            return (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: vencido ? '#fee2e2' : '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{f.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.razon_social || '—'}</div>
                  {f.vencimiento && (
                    <div style={{ fontSize: 11, color: vencido ? '#991b1b' : '#6b7280', fontWeight: vencido ? 700 : 400 }}>
                      {vencido ? `⚠️ Vencida hace ${diasVenc} día(s)` : `Vence: ${fmtDate(f.vencimiento)}`}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: ROJO }}>{fmt(t.total)}</div>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {/* TOP CLIENTES */}
      {widgetsActivos.includes('topClientes') && topClientes.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>🏆 Top 5 clientes {anoActual}</h4>
          {topClientes.map((x, i) => (
            <div key={x.cliente.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: ROJO, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.cliente.razon_social}</div>
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(x.importe / topClientes[0].importe) * 100}%`, background: ROJO }}></div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(x.importe)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* TOP GASTOS */}
      {widgetsActivos.includes('topGastos') && topGastos.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>💸 Top 5 categorías de gasto {anoActual}</h4>
          {topGastos.map(([cat, imp]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{cat}</div>
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(imp / topGastos[0][1]) * 100}%`, background: '#ef4444' }}></div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{fmt(imp)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* COMPARATIVA 6 MESES */}
      {widgetsActivos.includes('comparativaMensual') && (
        <Card style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>📈 Últimos 6 meses</h4>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, marginBottom: 10 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1a56db' }}></span> Ingresos</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444' }}></span> Gastos</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, padding: '0 8px' }}>
            {ultimosMeses.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
                  <div style={{ width: 14, height: `${(m.ingresos / maxMes) * 100}%`, background: '#1a56db', borderRadius: '2px 2px 0 0', minHeight: 2 }} title={`Ingresos: ${fmt(m.ingresos)}`}></div>
                  <div style={{ width: 14, height: `${(m.gastos / maxMes) * 100}%`, background: '#ef4444', borderRadius: '2px 2px 0 0', minHeight: 2 }} title={`Gastos: ${fmt(m.gastos)}`}></div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PRÓXIMOS VENCIMIENTOS FISCALES */}
      {widgetsActivos.includes('proximosVencs') && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800 }}>📆 Próximos vencimientos fiscales</h4>
            <button onClick={() => onNavegar('informes')} style={{ background: 'transparent', border: 'none', color: ROJO, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ver todos →</button>
          </div>
          {fechasFiscales.filter(f => new Date(f.fecha + 'T00:00:00') >= HOY_D).slice(0, 3).map((f, i) => {
            const d = new Date(f.fecha + 'T00:00:00')
            const dias = Math.round((d - HOY_D) / 86400000)
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <span style={{ background: dias <= 7 ? '#fee2e2' : dias <= 30 ? '#fef3c7' : '#f3f4f6', color: dias <= 7 ? '#991b1b' : dias <= 30 ? '#92400e' : '#374151', padding: '4px 10px', borderRadius: 10, fontSize: 11, fontWeight: 800, alignSelf: 'center' }}>en {dias}d</span>
              </div>
            )
          })}
        </Card>
      )}

      {/* ÚLTIMAS FACTURAS */}
      {widgetsActivos.includes('ultimasFacturas') && (
        <Card>
          <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>📄 Últimas facturas</h4>
          {[...facturas].sort((a, b) => String(b.id).localeCompare(String(a.id))).slice(0, 5).map(f => {
            const t = calcTotales(f)
            const c = getCliente(f.cliente_id)
            return (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f9fafb', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{f.id}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.razon_social || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{fmt(t.total)}</div>
                  <Badge estado={f.estado} />
                </div>
              </div>
            )
          })}
          {facturas.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No hay facturas todavía</div>}
        </Card>
      )}
    </div>
  )
}

function KPI({ label, value, accent, sub, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', padding: 14, borderRadius: 14, border: '1px solid #f3f4f6', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
function Card({ children, style }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f3f4f6', ...style }}>{children}</div>
}
function Badge({ estado }) {
  const m = {
    pendiente: { txt: 'Pendiente', bg: '#fef9c3', col: '#854d0e' },
    cobrada: { txt: 'Cobrada', bg: '#d1fae5', col: '#065f46' },
    vencida: { txt: 'Vencida', bg: '#fee2e2', col: '#991b1b' },
  }
  const e = m[estado] || m.pendiente
  return <span style={{ background: e.bg, color: e.col, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, display: 'inline-block', marginTop: 2 }}>{e.txt}</span>
}
