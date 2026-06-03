import { useState } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { facturasApi, gastosApi, clientesApi, proveedoresApi } from './lib/api'

const ROJO = '#c81019'
const EMPRESA = { nombre: 'QUESOS MAHER SL', nif: 'B37267259' }
const ANO_ACTUAL = new Date().getFullYear()
const TRIM_ACTUAL = Math.floor(new Date().getMonth() / 3) + 1

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

function descargarCSV(filename, contenido) {
  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function Informes() {
  const facturasC = useColeccion(facturasApi)
  const gastosC = useColeccion(gastosApi)
  const clientesC = useColeccion(clientesApi)
  const proveedoresC = useColeccion(proveedoresApi)

  const [vista, setVista] = useState('303')
  const [trim, setTrim] = useState(TRIM_ACTUAL)
  const [ano, setAno] = useState(ANO_ACTUAL)

  const facturas = facturasC.items
  const gastos = gastosC.items
  const clientes = clientesC.items
  const proveedores = proveedoresC.items

  const cargando = facturasC.cargando || gastosC.cargando || clientesC.cargando || proveedoresC.cargando

  const getCliente = (id) => clientes.find(c => c.id === id)
  const getProv = (id) => proveedores.find(p => p.id === id)

  const meses = [(trim - 1) * 3 + 1, (trim - 1) * 3 + 2, trim * 3]
  const enTrim = (fecha) => {
    if (!fecha) return false
    const d = new Date(fecha + 'T00:00:00')
    return d.getFullYear() === ano && meses.includes(d.getMonth() + 1)
  }
  const enAno = (fecha) => fecha && new Date(fecha + 'T00:00:00').getFullYear() === ano

  // No contar facturas rectificadas-anuladas ni nada raro: todas las del periodo
  const facsT = facturas.filter(f => enTrim(f.fecha))
  const facsA = facturas.filter(f => enAno(f.fecha))
  const gastT = gastos.filter(g => enTrim(g.fecha) && g.deducible)
  const gastA = gastos.filter(g => enAno(g.fecha) && g.deducible)

  // ─── IVA repercutido / soportado ───
  const calcIVA = (lista) => {
    const r = { base21: 0, iva21: 0, base10: 0, iva10: 0, base4: 0, iva4: 0, base0: 0 }
    lista.forEach(f => (f.lineas || []).forEach(l => {
      const b = (Number(l.cant) || 0) * (Number(l.precio) || 0)
      if (l.iva === 0.21) { r.base21 += b; r.iva21 += b * 0.21 }
      else if (l.iva === 0.10) { r.base10 += b; r.iva10 += b * 0.10 }
      else if (l.iva === 0.04) { r.base4 += b; r.iva4 += b * 0.04 }
      else r.base0 += b
    }))
    return r
  }

  const ivaRepT = calcIVA(facsT)
  const ivaRepA = calcIVA(facsA)
  const totalIVARepT = ivaRepT.iva21 + ivaRepT.iva10 + ivaRepT.iva4
  const totalIVARepA = ivaRepA.iva21 + ivaRepA.iva10 + ivaRepA.iva4

  const ivaSopT = gastT.reduce((s, g) => s + calcTotales(g).iva, 0)
  const ivaSopA = gastA.reduce((s, g) => s + calcTotales(g).iva, 0)

  const resIVA_T = totalIVARepT - ivaSopT
  const resIVA_A = totalIVARepA - ivaSopA

  // ─── Modelo 130 (IRPF) ───
  const ingTrim = facsT.reduce((s, f) => s + (f.lineas || []).reduce((a, l) => a + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0), 0)
  const gastDedT = gastT.reduce((s, g) => s + calcTotales(g).base, 0)
  const benefT = ingTrim - gastDedT
  const cuota130 = Math.max(0, benefT * 0.20)
  const irpfRepercutido = facsT.reduce((s, f) => s + calcTotales(f).irpf, 0)

  // ─── Modelo 347 ───
  const calcOps347 = () => {
    const provMap = {}
    gastA.forEach(g => {
      if (!g.proveedor_id) return
      provMap[g.proveedor_id] = (provMap[g.proveedor_id] || 0) + calcTotales(g).total
    })
    const cliMap = {}
    facsA.forEach(f => {
      if (!f.cliente_id) return
      const t = calcTotales(f)
      cliMap[f.cliente_id] = (cliMap[f.cliente_id] || 0) + t.base + t.iva
    })
    const provs = Object.entries(provMap).filter(([, v]) => v > 3005.06).map(([id, importe]) => ({ entidad: getProv(id), importe, tipo: 'Compras' }))
    const clis = Object.entries(cliMap).filter(([, v]) => v > 3005.06).map(([id, importe]) => ({ entidad: getCliente(id), importe, tipo: 'Ventas' }))
    return [...clis, ...provs]
  }
  const ops347 = calcOps347()

  // ─── Cuenta de pérdidas y ganancias ───
  const ingresosAnuales = facsA.reduce((s, f) => s + (f.lineas || []).reduce((a, l) => a + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0), 0)
  const gastosAnuales = gastA.reduce((s, g) => s + calcTotales(g).base, 0)
  const beneficioAntes = ingresosAnuales - gastosAnuales
  const impuestoEstimado = Math.max(0, beneficioAntes * 0.15)
  const beneficioNeto = beneficioAntes - impuestoEstimado

  // ─── Calendario fiscal ───
  const calendario = [
    { mes: 4, dia: 20, label: 'Modelo 303 - IVA 1T' },
    { mes: 4, dia: 20, label: 'Modelo 130 - IRPF 1T' },
    { mes: 4, dia: 20, label: 'Modelo 111 - Retenciones 1T' },
    { mes: 4, dia: 20, label: 'Modelo 115 - Alquileres 1T' },
    { mes: 7, dia: 20, label: 'Modelo 303 - IVA 2T' },
    { mes: 7, dia: 20, label: 'Modelo 130 - IRPF 2T' },
    { mes: 10, dia: 20, label: 'Modelo 303 - IVA 3T' },
    { mes: 10, dia: 20, label: 'Modelo 130 - IRPF 3T' },
    { mes: 1, dia: 30, label: 'Modelo 303 - IVA 4T' },
    { mes: 1, dia: 30, label: 'Modelo 130 - IRPF 4T' },
    { mes: 1, dia: 30, label: 'Modelo 390 - Resumen anual IVA' },
    { mes: 2, dia: 28, label: 'Modelo 347 - Operaciones >3.005€' },
    { mes: 7, dia: 25, label: 'Modelo 200 - Impuesto Sociedades' },
  ]
  const hoy = new Date()
  const proximosVencs = calendario
    .map(c => {
      let f = new Date(ANO_ACTUAL, c.mes - 1, c.dia)
      if (c.mes === 1 || c.mes === 2) f = new Date(ANO_ACTUAL + (hoy.getMonth() >= 2 ? 1 : 0), c.mes - 1, c.dia)
      return { ...c, fecha: f, dias: Math.ceil((f - hoy) / 86400000) }
    })
    .filter(c => c.dias >= -15 && c.dias <= 120)
    .sort((a, b) => a.dias - b.dias)

  // ─── EXPORTACIONES ───
  function exportar303() {
    let csv = 'MODELO 303 - IVA TRIMESTRAL\n'
    csv += `Periodo;${trim}T/${ano}\n`
    csv += `Empresa;${EMPRESA.nombre}\nNIF;${EMPRESA.nif}\n\n`
    csv += 'IVA DEVENGADO (REPERCUTIDO)\nConcepto;Base;Cuota\n'
    csv += `Operaciones 21%;${ivaRepT.base21.toFixed(2)};${ivaRepT.iva21.toFixed(2)}\n`
    csv += `Operaciones 10%;${ivaRepT.base10.toFixed(2)};${ivaRepT.iva10.toFixed(2)}\n`
    csv += `Operaciones 4%;${ivaRepT.base4.toFixed(2)};${ivaRepT.iva4.toFixed(2)}\n`
    csv += `Total IVA repercutido;;${totalIVARepT.toFixed(2)}\n\n`
    csv += 'IVA DEDUCIBLE (SOPORTADO)\n'
    csv += `IVA soportado deducible;;${ivaSopT.toFixed(2)}\n\n`
    csv += 'RESULTADO\n'
    csv += `Resultado;;${resIVA_T.toFixed(2)}\n`
    csv += `Estado;${resIVA_T >= 0 ? 'A INGRESAR' : 'A DEVOLVER/COMPENSAR'}\n\n`
    csv += 'DETALLE FACTURAS EMITIDAS\nFecha;Numero;Cliente;NIF;Base;IVA;Total\n'
    facsT.forEach(f => { const c = getCliente(f.cliente_id); const t = calcTotales(f); csv += `${fmtDate(f.fecha)};${f.id};${c?.razon_social || ''};${c?.nif || ''};${t.base.toFixed(2)};${t.iva.toFixed(2)};${t.total.toFixed(2)}\n` })
    csv += '\nDETALLE GASTOS DEDUCIBLES\nFecha;Concepto;Proveedor;NIF;Base;IVA;Total\n'
    gastT.forEach(g => { const p = getProv(g.proveedor_id); const t = calcTotales(g); csv += `${fmtDate(g.fecha)};${g.concepto};${p?.razon_social || ''};${p?.nif || ''};${t.base.toFixed(2)};${t.iva.toFixed(2)};${t.total.toFixed(2)}\n` })
    descargarCSV(`Modelo_303_${trim}T_${ano}.csv`, csv)
  }

  function exportar130() {
    let csv = 'MODELO 130 - IRPF AUTONOMOS\n'
    csv += `Periodo;${trim}T/${ano}\nEmpresa;${EMPRESA.nombre}\nNIF;${EMPRESA.nif}\n\n`
    csv += 'Concepto;Importe\n'
    csv += `Ingresos del trimestre;${ingTrim.toFixed(2)}\n`
    csv += `Gastos deducibles;${gastDedT.toFixed(2)}\n`
    csv += `Rendimiento neto;${benefT.toFixed(2)}\n`
    csv += `Retenciones IRPF practicadas por clientes;${irpfRepercutido.toFixed(2)}\n`
    csv += `Cuota a pagar (20%);${cuota130.toFixed(2)}\n`
    descargarCSV(`Modelo_130_${trim}T_${ano}.csv`, csv)
  }

  function exportar390() {
    let csv = 'MODELO 390 - RESUMEN ANUAL IVA\n'
    csv += `Ejercicio;${ano}\nEmpresa;${EMPRESA.nombre}\nNIF;${EMPRESA.nif}\n\n`
    csv += 'OPERACIONES POR TIPO (ANUAL)\nConcepto;Base;Cuota\n'
    csv += `Operaciones 21%;${ivaRepA.base21.toFixed(2)};${ivaRepA.iva21.toFixed(2)}\n`
    csv += `Operaciones 10%;${ivaRepA.base10.toFixed(2)};${ivaRepA.iva10.toFixed(2)}\n`
    csv += `Operaciones 4%;${ivaRepA.base4.toFixed(2)};${ivaRepA.iva4.toFixed(2)}\n\n`
    csv += `Total IVA repercutido;;${totalIVARepA.toFixed(2)}\n`
    csv += `Total IVA deducible;;${ivaSopA.toFixed(2)}\n`
    csv += `Resultado anual;;${resIVA_A.toFixed(2)}\n`
    descargarCSV(`Modelo_390_${ano}.csv`, csv)
  }

  function exportarLibroFacturas() {
    let csv = 'Fecha;Numero;Cliente;NIF;Base;IVA;Retencion;Total\n'
    facsA.forEach(f => { const c = getCliente(f.cliente_id); const t = calcTotales(f); csv += `${fmtDate(f.fecha)};${f.id};${c?.razon_social || ''};${c?.nif || ''};${t.base.toFixed(2)};${t.iva.toFixed(2)};${t.irpf.toFixed(2)};${t.total.toFixed(2)}\n` })
    descargarCSV(`Libro_Facturas_Emitidas_${ano}.csv`, csv)
  }

  function exportarLibroGastos() {
    let csv = 'Fecha;Concepto;Proveedor;NIF;Base;IVA;Total;Categoria;Deducible\n'
    gastA.forEach(g => { const p = getProv(g.proveedor_id); const t = calcTotales(g); csv += `${fmtDate(g.fecha)};${g.concepto};${p?.razon_social || ''};${p?.nif || ''};${t.base.toFixed(2)};${t.iva.toFixed(2)};${t.total.toFixed(2)};${g.categoria};${g.deducible ? 'Si' : 'No'}\n` })
    descargarCSV(`Libro_Facturas_Recibidas_${ano}.csv`, csv)
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando datos…</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Informes fiscales</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>Cálculos orientativos a partir de tus facturas y gastos. Revísalos siempre con tu gestor.</p>

      {/* Selector de periodo */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={miniLabel}>Trimestre</label>
          <select style={selStyle} value={trim} onChange={e => setTrim(parseInt(e.target.value))}>
            <option value={1}>1T (ene-mar)</option>
            <option value={2}>2T (abr-jun)</option>
            <option value={3}>3T (jul-sep)</option>
            <option value={4}>4T (oct-dic)</option>
          </select>
        </div>
        <div>
          <label style={miniLabel}>Año</label>
          <select style={selStyle} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
            {[ANO_ACTUAL, ANO_ACTUAL - 1, ANO_ACTUAL - 2].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Pestañas de modelos */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['303', 'Modelo 303 (IVA)'], ['130', 'Modelo 130 (IRPF)'], ['390', 'Modelo 390 (anual)'], ['347', 'Modelo 347'], ['pyg', 'Pérdidas y Ganancias'], ['calendario', 'Calendario'], ['libros', 'Libros / Exportar']].map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)}
            style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: vista === id ? 'none' : '1.5px solid #e5e7eb',
              background: vista === id ? ROJO : '#fff',
              color: vista === id ? '#fff' : '#6b7280',
            }}>{label}</button>
        ))}
      </div>

      {/* ───── MODELO 303 ───── */}
      {vista === '303' && (
        <Tarjeta>
          <TituloModelo>Modelo 303 · IVA · {trim}T/{ano}</TituloModelo>
          <Seccion titulo="IVA repercutido (cobrado a clientes)">
            <Fila label="Base 21%" valor={fmt(ivaRepT.base21)} sub={fmt(ivaRepT.iva21)} />
            <Fila label="Base 10%" valor={fmt(ivaRepT.base10)} sub={fmt(ivaRepT.iva10)} />
            <Fila label="Base 4%" valor={fmt(ivaRepT.base4)} sub={fmt(ivaRepT.iva4)} />
            <Fila label="Total IVA repercutido" valor={fmt(totalIVARepT)} bold />
          </Seccion>
          <Seccion titulo="IVA soportado (pagado en gastos deducibles)">
            <Fila label="Total IVA soportado" valor={fmt(ivaSopT)} bold />
          </Seccion>
          <ResultadoBox label="Resultado del trimestre" valor={resIVA_T}
            estado={resIVA_T >= 0 ? 'A INGRESAR a Hacienda' : 'A DEVOLVER / COMPENSAR'} />
          <BotonExportar onClick={exportar303}>📥 Exportar Modelo 303 (CSV)</BotonExportar>
        </Tarjeta>
      )}

      {/* ───── MODELO 130 ───── */}
      {vista === '130' && (
        <Tarjeta>
          <TituloModelo>Modelo 130 · IRPF · {trim}T/{ano}</TituloModelo>
          <Fila label="Ingresos del trimestre" valor={fmt(ingTrim)} />
          <Fila label="Gastos deducibles" valor={'−' + fmt(gastDedT)} />
          <Fila label="Rendimiento neto" valor={fmt(benefT)} bold />
          <Fila label="Retenciones ya practicadas por clientes" valor={fmt(irpfRepercutido)} />
          <ResultadoBox label="Pago fraccionado (20% del rendimiento)" valor={cuota130}
            estado={cuota130 > 0 ? 'A INGRESAR' : 'Sin cuota (no hay beneficio)'} forzarColor="#854d0e" />
          <BotonExportar onClick={exportar130}>📥 Exportar Modelo 130 (CSV)</BotonExportar>
        </Tarjeta>
      )}

      {/* ───── MODELO 390 ───── */}
      {vista === '390' && (
        <Tarjeta>
          <TituloModelo>Modelo 390 · Resumen anual IVA · {ano}</TituloModelo>
          <Seccion titulo="Operaciones por tipo (todo el año)">
            <Fila label="Base 21%" valor={fmt(ivaRepA.base21)} sub={fmt(ivaRepA.iva21)} />
            <Fila label="Base 10%" valor={fmt(ivaRepA.base10)} sub={fmt(ivaRepA.iva10)} />
            <Fila label="Base 4%" valor={fmt(ivaRepA.base4)} sub={fmt(ivaRepA.iva4)} />
          </Seccion>
          <Fila label="Total IVA repercutido (anual)" valor={fmt(totalIVARepA)} bold />
          <Fila label="Total IVA soportado (anual)" valor={fmt(ivaSopA)} bold />
          <ResultadoBox label="Resultado anual IVA" valor={resIVA_A}
            estado={resIVA_A >= 0 ? 'Resultado a favor de Hacienda' : 'A favor de la empresa'} />
          <BotonExportar onClick={exportar390}>📥 Exportar Modelo 390 (CSV)</BotonExportar>
        </Tarjeta>
      )}

      {/* ───── MODELO 347 ───── */}
      {vista === '347' && (
        <Tarjeta>
          <TituloModelo>Modelo 347 · Operaciones &gt; 3.005,06 € · {ano}</TituloModelo>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Clientes y proveedores con los que has superado 3.005,06 € en el año (IVA incluido).</p>
          {ops347.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>No hay operaciones que superen el umbral este año.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ops347.map((op, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f9fafb', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{op.entidad?.razon_social || '— sin nombre —'}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{op.entidad?.nif || 'sin NIF'} · {op.tipo}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: ROJO }}>{fmt(op.importe)}</div>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      )}

      {/* ───── PÉRDIDAS Y GANANCIAS ───── */}
      {vista === 'pyg' && (
        <Tarjeta>
          <TituloModelo>Cuenta de Pérdidas y Ganancias · {ano}</TituloModelo>
          <Fila label="Ingresos anuales (ventas)" valor={fmt(ingresosAnuales)} />
          <Fila label="Gastos deducibles" valor={'−' + fmt(gastosAnuales)} />
          <Fila label="Beneficio antes de impuestos" valor={fmt(beneficioAntes)} bold />
          <Fila label="Impuesto estimado (15% pymes)" valor={'−' + fmt(impuestoEstimado)} />
          <ResultadoBox label="Beneficio neto estimado" valor={beneficioNeto}
            estado={beneficioNeto >= 0 ? 'Beneficio' : 'Pérdidas'} />
        </Tarjeta>
      )}

      {/* ───── CALENDARIO FISCAL ───── */}
      {vista === 'calendario' && (
        <Tarjeta>
          <TituloModelo>Calendario fiscal · próximos vencimientos</TituloModelo>
          {proximosVencs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>No hay vencimientos próximos.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proximosVencs.map((c, i) => {
                const urgente = c.dias <= 15
                const pasado = c.dias < 0
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: pasado ? '#fef2f2' : urgente ? '#fff7ed' : '#f9fafb', borderRadius: 10, border: urgente && !pasado ? '1.5px solid #fed7aa' : '1px solid transparent' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.fecha.toLocaleDateString('es-ES')}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: pasado ? '#991b1b' : urgente ? '#9a3412' : '#6b7280' }}>
                      {pasado ? `Hace ${Math.abs(c.dias)} días` : c.dias === 0 ? '¡HOY!' : `En ${c.dias} días`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Tarjeta>
      )}

      {/* ───── LIBROS / EXPORTAR ───── */}
      {vista === 'libros' && (
        <Tarjeta>
          <TituloModelo>Libros contables · Exportar para el gestor</TituloModelo>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Descarga los libros en CSV (se abren en Excel o Calc) para enviárselos a tu gestoría.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BotonExportar onClick={exportarLibroFacturas}>📘 Libro de facturas emitidas {ano}</BotonExportar>
            <BotonExportar onClick={exportarLibroGastos}>📕 Libro de facturas recibidas (gastos) {ano}</BotonExportar>
          </div>
        </Tarjeta>
      )}

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginTop: 16, fontSize: 12.5, color: '#92400e', lineHeight: 1.5 }}>
        ⚠️ <strong>Importante:</strong> estos cálculos son orientativos y te ayudan a tener una visión de tu situación fiscal. No sustituyen el trabajo de tu gestor o asesor fiscal. Revísalos siempre con un profesional antes de presentar cualquier modelo.
      </div>
    </div>
  )
}

// ─── Componentes visuales ───
function Tarjeta({ children }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>{children}</div>
}
function TituloModelo({ children }) {
  return <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 16, color: ROJO }}>{children}</h3>
}
function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Fila({ label, valor, sub, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 14, color: '#374151', fontWeight: bold ? 800 : 500 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: bold ? 800 : 600, color: bold ? ROJO : '#111827' }}>{valor}</div>
        {sub !== undefined && <div style={{ fontSize: 11, color: '#9ca3af' }}>IVA: {sub}</div>}
      </div>
    </div>
  )
}
function ResultadoBox({ label, valor, estado, forzarColor }) {
  const positivo = valor >= 0
  const color = forzarColor || (positivo ? ROJO : '#059669')
  return (
    <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, marginTop: 14, textAlign: 'center', border: `1.5px solid ${color}22` }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{fmt(Math.abs(valor))}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 4 }}>{estado}</div>
    </div>
  )
}
function BotonExportar({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 14 }}>
      {children}
    </button>
  )
}

const miniLabel = { display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 3 }
const selStyle = { border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' }
