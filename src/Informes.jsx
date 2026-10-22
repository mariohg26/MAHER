import { useState, useEffect } from 'react'
import { useColeccion } from './hooks/useColeccion'
import { facturasApi, gastosApi, clientesApi, proveedoresApi, empresaApi } from './lib/api'
import {
  desglose, calcular303, calcular390, calcularRetencionesPracticadas, calcular347,
  calcularPyG, calcular202, calendarioFiscal, tiposIS, porcentaje202Base, PERIODOS_202, REGIMENES_IS,
  UMBRAL_347, csvNum, csvTxt, csvFecha, csvFila, enAno, esAlquiler,
} from './lib/fiscal'

const ROJO = '#c81019'
const EMPRESA_DEFECTO = { nombre: 'QUESOS MAHER SL', nif: 'B37267259' }
const HOY = new Date()
const ANO_ACTUAL = HOY.getFullYear()
const TRIM_ACTUAL = Math.floor(HOY.getMonth() / 3) + 1

const fmt = (n) => (Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
const pct = (t) => (Math.round(t * 10000) / 100).toString().replace('.', ',') + ' %'

function descargarCSV(nombre, contenido) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Próximo pago del 202 (para abrir esa pestaña en el periodo que toca)
function periodo202Actual() {
  const mes = HOY.getMonth() + 1
  if (mes <= 4) return 1
  if (mes <= 10) return 2
  return 3
}

export default function Informes() {
  const facturasC = useColeccion(facturasApi)
  const gastosC = useColeccion(gastosApi)
  const clientesC = useColeccion(clientesApi)
  const proveedoresC = useColeccion(proveedoresApi)

  const [vista, setVista] = useState('303')
  const [trim, setTrim] = useState(TRIM_ACTUAL)
  const [ano, setAno] = useState(ANO_ACTUAL)
  const [periodo202, setPeriodo202] = useState(periodo202Actual())
  const [empresa, setEmpresa] = useState(null)
  const [ajustes, setAjustes] = useState({ regimenIS: 'erd', baseUltimoIS: '' })
  const [avisoAjuste, setAvisoAjuste] = useState('')

  useEffect(() => {
    empresaApi.get().then(e => {
      setEmpresa(e)
      const c = e?.config || {}
      let local = {}
      try { local = JSON.parse(localStorage.getItem('maher_ajustes_fiscales')) || {} } catch (err) {}
      setAjustes({
        regimenIS: c.regimenIS || local.regimenIS || 'erd',
        baseUltimoIS: c.baseUltimoIS ?? local.baseUltimoIS ?? '',
      })
    }).catch(() => {})
  }, [])

  // Guarda el régimen de Sociedades y el dato del último impuesto (en la empresa si eres admin)
  async function guardarAjuste(cambios) {
    const nuevos = { ...ajustes, ...cambios }
    setAjustes(nuevos)
    try { localStorage.setItem('maher_ajustes_fiscales', JSON.stringify(nuevos)) } catch (e) {}
    if (!empresa) return
    try {
      const actualizada = await empresaApi.update(empresa.id, { config: { ...(empresa.config || {}), ...cambios } })
      setEmpresa(actualizada)
      setAvisoAjuste('Guardado')
    } catch (e) {
      setAvisoAjuste('Guardado solo en este dispositivo')
    }
    setTimeout(() => setAvisoAjuste(''), 2500)
  }

  const facturas = facturasC.items
  const gastos = gastosC.items
  const clientes = clientesC.items
  const proveedores = proveedoresC.items
  const cargando = facturasC.cargando || gastosC.cargando || clientesC.cargando || proveedoresC.cargando

  const EMP = { nombre: empresa?.nombre || EMPRESA_DEFECTO.nombre, nif: empresa?.nif || EMPRESA_DEFECTO.nif }
  const getCliente = (id) => clientes.find(c => c.id === id)
  const getProv = (id) => proveedores.find(p => p.id === id)

  // ─── Cálculos ───
  const m303 = calcular303({ facturas, gastos, ano, trim })
  const m390 = calcular390({ facturas, gastos, ano })
  const ret = calcularRetencionesPracticadas({ gastos, ano, trim, proveedores })
  const retAnual = calcularRetencionesPracticadas({ gastos, ano, proveedores })
  const m347 = calcular347({ facturas, gastos, clientes, proveedores, ano })
  const pyg = calcularPyG({ facturas, gastos, ano, regimen: ajustes.regimenIS })
  const m202 = calcular202({ facturas, gastos, ano, periodo: periodo202, regimen: ajustes.regimenIS, baseUltimoIS: ajustes.baseUltimoIS })
  const tipos = tiposIS(ajustes.regimenIS, ano)
  const pct202 = porcentaje202Base(ajustes.regimenIS, ano)

  // Calendario: 115/111 solo si en el último año ha habido gastos con retención
  const haceUnAno = new Date(HOY); haceUnAno.setFullYear(haceUnAno.getFullYear() - 1)
  const recientes = gastos.filter(g => g.fecha && new Date(g.fecha + 'T00:00:00') >= haceUnAno && (Number(g.retencion_irpf) || 0) > 0)
  const con115 = recientes.some(esAlquiler)
  const con111 = recientes.some(g => !esAlquiler(g))
  const vencimientos = calendarioFiscal(ANO_ACTUAL, { con115, con111 })
    .map(c => ({ ...c, dias: Math.ceil((c.fecha - new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate())) / 86400000) }))
    .filter(c => c.dias >= -10 && c.dias <= 150)

  // ─── Exportaciones (CSV para Excel: punto y coma y coma decimal) ───
  const cabecera = (titulo, periodo) => csvFila(csvTxt(titulo)) + csvFila('Periodo', csvTxt(periodo)) + csvFila('Empresa', csvTxt(EMP.nombre)) + csvFila('NIF', EMP.nif) + '\n'

  function exportar303() {
    let csv = cabecera('MODELO 303 - IVA', `${trim}T ${ano}`)
    csv += 'IVA DEVENGADO\n' + csvFila('Tipo', 'Base', 'Cuota')
    m303.devengado.tipos.forEach(t => { csv += csvFila(pct(t.tipo), csvNum(t.base), csvNum(t.cuota)) })
    csv += csvFila('Total', csvNum(m303.devengado.base), csvNum(m303.devengado.cuota)) + '\n'
    csv += 'IVA DEDUCIBLE\n' + csvFila('Tipo', 'Base', 'Cuota')
    m303.deducible.tipos.forEach(t => { csv += csvFila(pct(t.tipo), csvNum(t.base), csvNum(t.cuota)) })
    csv += csvFila('Total', csvNum(m303.deducible.base), csvNum(m303.deducible.cuota)) + '\n'
    csv += csvFila('RESULTADO', '', csvNum(m303.resultado)) + '\n'
    csv += 'FACTURAS EMITIDAS\n' + csvFila('Fecha', 'Numero', 'Cliente', 'NIF', 'Base', 'IVA', 'Retencion', 'Total')
    m303.emitidas.forEach(f => { const c = getCliente(f.cliente_id); const t = desglose(f); csv += csvFila(csvFecha(f.fecha), csvTxt(f.id), csvTxt(c?.razon_social), csvTxt(c?.nif), csvNum(t.base), csvNum(t.iva), csvNum(t.retencion), csvNum(t.total)) })
    csv += '\nGASTOS DEDUCIBLES\n' + csvFila('Fecha', 'Concepto', 'Proveedor', 'NIF', 'Base', 'IVA', 'Retencion', 'Total')
    m303.recibidas.forEach(g => { const p = getProv(g.proveedor_id); const t = desglose(g); csv += csvFila(csvFecha(g.fecha), csvTxt(g.concepto), csvTxt(p?.razon_social), csvTxt(p?.nif), csvNum(t.base), csvNum(t.iva), csvNum(t.retencion), csvNum(t.total)) })
    descargarCSV(`Modelo_303_${trim}T_${ano}.csv`, csv)
  }

  function exportar390() {
    let csv = cabecera('MODELO 390 - RESUMEN ANUAL IVA', String(ano))
    csv += 'IVA DEVENGADO\n' + csvFila('Tipo', 'Base', 'Cuota')
    m390.devengado.tipos.forEach(t => { csv += csvFila(pct(t.tipo), csvNum(t.base), csvNum(t.cuota)) })
    csv += csvFila('Total', csvNum(m390.devengado.base), csvNum(m390.devengado.cuota)) + '\n'
    csv += 'IVA DEDUCIBLE\n' + csvFila('Tipo', 'Base', 'Cuota')
    m390.deducible.tipos.forEach(t => { csv += csvFila(pct(t.tipo), csvNum(t.base), csvNum(t.cuota)) })
    csv += csvFila('Total', csvNum(m390.deducible.base), csvNum(m390.deducible.cuota)) + '\n'
    csv += 'RESULTADO POR TRIMESTRE\n'
    m390.porTrimestre.forEach((r, i) => { csv += csvFila(`${i + 1}T`, csvNum(r)) })
    csv += csvFila('Resultado anual', csvNum(m390.resultado))
    descargarCSV(`Modelo_390_${ano}.csv`, csv)
  }

  function exportarRetenciones() {
    let csv = cabecera('RETENCIONES PRACTICADAS (MODELOS 115 Y 111)', `${trim}T ${ano}`)
    for (const [titulo, r] of [['MODELO 115 - ALQUILERES', ret.m115], ['MODELO 111 - PROFESIONALES Y OTROS', ret.m111]]) {
      csv += titulo + '\n' + csvFila('Fecha', 'Concepto', 'Perceptor', 'NIF', 'Base', 'Tipo', 'Retencion')
      r.gastos.forEach(g => { const p = getProv(g.proveedor_id); const t = desglose(g); csv += csvFila(csvFecha(g.fecha), csvTxt(g.concepto), csvTxt(p?.razon_social), csvTxt(p?.nif), csvNum(t.base), pct(Number(g.retencion_irpf) || 0), csvNum(t.retencion)) })
      csv += csvFila('Total', '', '', '', csvNum(r.base), '', csvNum(r.retencion)) + '\n'
    }
    csv += `RESUMEN ANUAL ${ano} (modelos 180 y 190)\n` + csvFila('Modelo', 'Perceptor', 'NIF', 'Base', 'Retencion')
    for (const [mod, r] of [['180', retAnual.m115], ['190', retAnual.m111]]) {
      r.perceptores.forEach(p => { csv += csvFila(mod, csvTxt(p.proveedor?.razon_social), csvTxt(p.proveedor?.nif), csvNum(p.base), csvNum(p.retencion)) })
    }
    descargarCSV(`Retenciones_115_111_${trim}T_${ano}.csv`, csv)
  }

  function exportar347() {
    let csv = cabecera('MODELO 347 - OPERACIONES CON TERCEROS', String(ano))
    csv += csvFila('Clave', 'Tipo', 'Nombre', 'NIF', '1T', '2T', '3T', '4T', 'Total anual')
    m347.declarados.forEach(o => { csv += csvFila(o.clave, o.tipo, csvTxt(o.entidad?.razon_social), csvTxt(o.entidad?.nif), ...o.trimestres.map(csvNum), csvNum(o.total)) })
    descargarCSV(`Modelo_347_${ano}.csv`, csv)
  }

  function exportarLibroFacturas() {
    let csv = csvFila('Fecha', 'Numero', 'Cliente', 'NIF', 'Base', 'Tipo IVA', 'IVA', 'Retencion', 'Total')
    facturas.filter(f => enAno(f.fecha, ano)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id))).forEach(f => {
      const c = getCliente(f.cliente_id); const t = desglose(f)
      csv += csvFila(csvFecha(f.fecha), csvTxt(f.id), csvTxt(c?.razon_social), csvTxt(c?.nif), csvNum(t.base), t.tipos.map(x => pct(x.tipo)).join(' + '), csvNum(t.iva), csvNum(t.retencion), csvNum(t.total))
    })
    descargarCSV(`Libro_Facturas_Emitidas_${ano}.csv`, csv)
  }

  function exportarLibroGastos() {
    let csv = csvFila('Fecha', 'Concepto', 'Proveedor', 'NIF', 'Base', 'Tipo IVA', 'IVA', 'Retencion', 'Total', 'Categoria', 'Deducible')
    gastos.filter(g => enAno(g.fecha, ano)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach(g => {
      const p = getProv(g.proveedor_id); const t = desglose(g)
      csv += csvFila(csvFecha(g.fecha), csvTxt(g.concepto), csvTxt(p?.razon_social), csvTxt(p?.nif), csvNum(t.base), t.tipos.map(x => pct(x.tipo)).join(' + '), csvNum(t.iva), csvNum(t.retencion), csvNum(t.total), csvTxt(g.categoria), g.deducible === false ? 'No' : 'Si')
    })
    descargarCSV(`Libro_Facturas_Recibidas_${ano}.csv`, csv)
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando datos…</div>

  const usaTrimestre = ['303', 'retenciones'].includes(vista)
  const resultado303Texto = m303.resultado >= 0
    ? 'A INGRESAR'
    : trim < 4 ? 'A COMPENSAR en los próximos trimestres' : 'A DEVOLVER o compensar'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Informes fiscales</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>Cálculos orientativos a partir de tus facturas y gastos. Revísalos siempre con tu gestor.</p>

      {/* Pestañas de modelos */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['303', 'IVA · 303'], ['202', 'Sociedades · 202'], ['retenciones', 'Retenciones · 115/111'], ['390', 'IVA anual · 390'], ['347', '347'], ['pyg', 'Pérdidas y Ganancias'], ['calendario', 'Calendario'], ['libros', 'Libros / Exportar']].map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)}
            style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: vista === id ? 'none' : '1.5px solid #e5e7eb',
              background: vista === id ? ROJO : '#fff',
              color: vista === id ? '#fff' : '#6b7280',
            }}>{label}</button>
        ))}
      </div>

      {/* Selector de periodo */}
      {vista !== 'calendario' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {usaTrimestre && (
            <div>
              <label style={miniLabel}>Trimestre</label>
              <select style={selStyle} value={trim} onChange={e => setTrim(parseInt(e.target.value))}>
                <option value={1}>1T (ene-mar)</option>
                <option value={2}>2T (abr-jun)</option>
                <option value={3}>3T (jul-sep)</option>
                <option value={4}>4T (oct-dic)</option>
              </select>
            </div>
          )}
          {vista === '202' && (
            <div>
              <label style={miniLabel}>Pago</label>
              <select style={selStyle} value={periodo202} onChange={e => setPeriodo202(parseInt(e.target.value))}>
                {PERIODOS_202.map(p => <option key={p.p} value={p.p}>{p.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={miniLabel}>Año</label>
            <select style={selStyle} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
              {[ANO_ACTUAL, ANO_ACTUAL - 1, ANO_ACTUAL - 2, ANO_ACTUAL - 3].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ───── MODELO 303 ───── */}
      {vista === '303' && (
        <Tarjeta>
          <TituloModelo>Modelo 303 · IVA · {trim}T {ano}</TituloModelo>
          <Seccion titulo={`IVA devengado · ${m303.emitidas.length} factura(s) emitida(s)`}>
            {m303.devengado.tipos.length === 0 && <Vacio>Sin facturas en este trimestre</Vacio>}
            {m303.devengado.tipos.map(t => <Fila key={t.tipo} label={t.tipo === 0 ? 'Exento / 0 %' : `Base al ${pct(t.tipo)}`} valor={fmt(t.base)} sub={fmt(t.cuota)} />)}
            <Fila label="Total IVA devengado" valor={fmt(m303.devengado.cuota)} bold />
          </Seccion>
          <Seccion titulo={`IVA deducible · ${m303.recibidas.length} gasto(s) deducible(s)`}>
            {m303.deducible.tipos.map(t => <Fila key={t.tipo} label={t.tipo === 0 ? 'Sin IVA' : `Base al ${pct(t.tipo)}`} valor={fmt(t.base)} sub={fmt(t.cuota)} />)}
            <Fila label="Total IVA deducible" valor={fmt(m303.deducible.cuota)} bold />
          </Seccion>
          <ResultadoBox label="Resultado del trimestre" valor={m303.resultado} estado={resultado303Texto} />
          <Nota>Si en trimestres anteriores te salió a compensar, réstalo aquí: la app no lo arrastra sola.</Nota>
          <BotonExportar onClick={exportar303}>📥 Exportar Modelo 303 (Excel)</BotonExportar>
        </Tarjeta>
      )}

      {/* ───── MODELO 202 ───── */}
      {vista === '202' && (
        <Tarjeta>
          <TituloModelo>Modelo 202 · Pago a cuenta de Sociedades · {ano}</TituloModelo>
          <Nota>Una SL no presenta el 130 (es de autónomos): adelanta el Impuesto sobre Sociedades con el 202 en abril, octubre y diciembre.</Nota>

          <SelectorRegimen ajustes={ajustes} guardar={guardarAjuste} aviso={avisoAjuste} />

          <Seccion titulo="Modalidad normal · 18 % del último Impuesto de Sociedades (art. 40.2)">
            <label style={{ ...miniLabel, marginTop: 4 }}>Base: cuota del último Impuesto de Sociedades presentado, menos deducciones, bonificaciones y retenciones (te la da tu gestor)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="number" inputMode="decimal" step="0.01" min="0" style={{ ...selStyle, flex: 1, minWidth: 0 }}
                value={ajustes.baseUltimoIS} placeholder="Ej. 2500"
                onChange={e => setAjustes({ ...ajustes, baseUltimoIS: e.target.value })}
                onBlur={e => guardarAjuste({ baseUltimoIS: e.target.value })} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>€</span>
            </div>
            <ResultadoBox label={`Pago ${PERIODOS_202[periodo202 - 1].label} · modalidad normal`} valor={m202.modalidadCuota}
              estado={ajustes.baseUltimoIS === '' ? 'Escribe la base para calcularlo' : m202.modalidadCuota > 0 ? 'A INGRESAR' : 'Sin pago (0 €)'} forzarColor="#854d0e" />
          </Seccion>

          <Seccion titulo={`Si optaste por la modalidad de base (art. 40.3) · ${pct(pct202.tramo1)}${pct202.limiteTramo1 ? ` / ${pct(pct202.resto)}` : ''} del beneficio acumulado`}>
            {m202.detalle.map(d => (
              <div key={d.p} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', opacity: d.p === periodo202 ? 1 : 0.6 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                  Beneficio acumulado {fmt(d.base)} → {fmt(d.bruto)}<br />
                  − retenciones de tus clientes {fmt(d.retenciones)} − pagos anteriores {fmt(d.pagadoAntes)}
                  <b style={{ marginLeft: 6, color: d.aPagar > 0 ? ROJO : '#059669' }}>= {fmt(d.aPagar)}</b>
                </div>
              </div>
            ))}
            <Nota>Esta modalidad solo se aplica si la elegiste en el censo (036) o si facturas más de 6 millones. Si no, vale la de arriba.</Nota>
          </Seccion>
        </Tarjeta>
      )}

      {/* ───── RETENCIONES 115 / 111 ───── */}
      {vista === 'retenciones' && (
        <Tarjeta>
          <TituloModelo>Retenciones que practicas · {trim}T {ano}</TituloModelo>
          <Nota>Cuando pagas un alquiler o a un profesional con retención, esa retención la ingresas tú en Hacienda cada trimestre.</Nota>
          {[['Modelo 115 · Alquileres de locales', ret.m115], ['Modelo 111 · Profesionales y otros', ret.m111]].map(([titulo, r]) => (
            <Seccion key={titulo} titulo={titulo}>
              {r.gastos.length === 0 ? <Vacio>Sin gastos con retención este trimestre</Vacio> : (
                <>
                  {r.perceptores.map((p, i) => (
                    <Fila key={i} label={`${p.proveedor?.razon_social || '— sin proveedor —'} · ${p.n} pago(s)`} valor={fmt(p.retencion)} subTexto={`Base ${fmt(p.base)}`} />
                  ))}
                  <Fila label="Total a ingresar" valor={fmt(r.retencion)} bold />
                </>
              )}
            </Seccion>
          ))}
          <Nota>En enero se presenta además el resumen anual: modelo 180 (alquileres) y 190 (profesionales). Van incluidos en la exportación.</Nota>
          <BotonExportar onClick={exportarRetenciones}>📥 Exportar retenciones (Excel)</BotonExportar>
        </Tarjeta>
      )}

      {/* ───── MODELO 390 ───── */}
      {vista === '390' && (
        <Tarjeta>
          <TituloModelo>Modelo 390 · Resumen anual de IVA · {ano}</TituloModelo>
          <Seccion titulo="IVA devengado (todo el año)">
            {m390.devengado.tipos.map(t => <Fila key={t.tipo} label={t.tipo === 0 ? 'Exento / 0 %' : `Base al ${pct(t.tipo)}`} valor={fmt(t.base)} sub={fmt(t.cuota)} />)}
            <Fila label="Total IVA devengado" valor={fmt(m390.devengado.cuota)} bold />
          </Seccion>
          <Seccion titulo="IVA deducible (todo el año)">
            {m390.deducible.tipos.map(t => <Fila key={t.tipo} label={t.tipo === 0 ? 'Sin IVA' : `Base al ${pct(t.tipo)}`} valor={fmt(t.base)} sub={fmt(t.cuota)} />)}
            <Fila label="Total IVA deducible" valor={fmt(m390.deducible.cuota)} bold />
          </Seccion>
          <Seccion titulo="Resultado de cada 303">
            {m390.porTrimestre.map((r, i) => <Fila key={i} label={`${i + 1}T`} valor={fmt(r)} />)}
          </Seccion>
          <ResultadoBox label="Resultado anual (suma de los cuatro trimestres)" valor={m390.resultado}
            estado={m390.resultado >= 0 ? 'A favor de Hacienda' : 'A favor de la empresa'} />
          <BotonExportar onClick={exportar390}>📥 Exportar Modelo 390 (Excel)</BotonExportar>
        </Tarjeta>
      )}

      {/* ───── MODELO 347 ───── */}
      {vista === '347' && (
        <Tarjeta>
          <TituloModelo>Modelo 347 · Operaciones con terceros · {ano}</TituloModelo>
          <Nota>Clientes y proveedores con más de {fmt(UMBRAL_347)} en el año, IVA incluido y desglosado por trimestres. No se incluyen los alquileres ni los pagos con retención (ya van en el 180/190) ni las operaciones con el extranjero.</Nota>
          {m347.declarados.length === 0 ? (
            <Vacio>Nadie supera el umbral este año</Vacio>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {m347.declarados.map(op => (
                <div key={op.tipo + op.id} style={{ padding: 12, background: '#f9fafb', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{op.entidad?.razon_social || '— sin nombre —'}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{op.entidad?.nif || 'sin NIF'} · {op.tipo} (clave {op.clave})</div>
                    </div>
                    <div style={{ fontWeight: 800, color: ROJO, whiteSpace: 'nowrap' }}>{fmt(op.total)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 8 }}>
                    {op.trimestres.map((v, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 6, padding: '4px 6px', fontSize: 11, textAlign: 'center' }}>
                        <div style={{ color: '#9ca3af', fontWeight: 700 }}>{i + 1}T</div>
                        <div style={{ fontWeight: 700 }}>{fmt(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(m347.excluidas.conRetencion > 0 || m347.excluidas.extranjero > 0) && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
              Fuera del 347: {fmt(m347.excluidas.conRetencion)} con retención{m347.excluidas.extranjero > 0 ? ` y ${fmt(m347.excluidas.extranjero)} con el extranjero` : ''}.
            </div>
          )}
          {m347.declarados.length > 0 && <BotonExportar onClick={exportar347}>📥 Exportar Modelo 347 (Excel)</BotonExportar>}
        </Tarjeta>
      )}

      {/* ───── PÉRDIDAS Y GANANCIAS ───── */}
      {vista === 'pyg' && (
        <Tarjeta>
          <TituloModelo>Pérdidas y Ganancias · {ano}</TituloModelo>
          <Fila label="Ingresos (base de tus facturas)" valor={fmt(pyg.ingresos)} />
          <Fila label="Gastos" valor={'- ' + fmt(pyg.gastosTotales)} />
          <Fila label="Resultado antes de impuestos" valor={fmt(pyg.resultado)} bold />
          {pyg.gastosNoDeducibles > 0 && <Fila label="+ Gastos no deducibles (no restan para el impuesto)" valor={fmt(pyg.gastosNoDeducibles)} />}

          <SelectorRegimen ajustes={ajustes} guardar={guardarAjuste} aviso={avisoAjuste} />

          <Fila label={`Impuesto sobre Sociedades estimado (${tipos.limiteTramo1 ? `${pct(tipos.tramo1)} hasta 50.000 € y ${pct(tipos.resto)} el resto` : pct(tipos.tramo1)})`} valor={'- ' + fmt(pyg.impuesto)} />
          <ResultadoBox label="Beneficio neto estimado" valor={pyg.beneficioNeto} estado={pyg.beneficioNeto >= 0 ? 'Beneficio' : 'Pérdidas'} forzarColor={pyg.beneficioNeto >= 0 ? '#059669' : ROJO} />

          <Seccion titulo="Lo que te quedaría por pagar del impuesto">
            <Fila label="Impuesto estimado" valor={fmt(pyg.impuesto)} />
            <Fila label="- Retenciones que te han hecho tus clientes" valor={'- ' + fmt(pyg.retencionesSoportadas)} />
            <Fila label={pyg.cuotaDiferencial >= 0 ? 'Quedaría a pagar (antes de los 202)' : 'Te devolverían (antes de los 202)'} valor={fmt(Math.abs(pyg.cuotaDiferencial))} bold />
          </Seccion>
        </Tarjeta>
      )}

      {/* ───── CALENDARIO FISCAL ───── */}
      {vista === 'calendario' && (
        <Tarjeta>
          <TituloModelo>Calendario fiscal · próximos meses</TituloModelo>
          {vencimientos.length === 0 ? <Vacio>No hay vencimientos próximos</Vacio> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vencimientos.map((c, i) => {
                const urgente = c.dias <= 15, pasado = c.dias < 0
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 12, background: pasado ? '#fef2f2' : urgente ? '#fff7ed' : '#f9fafb', borderRadius: 10, border: urgente && !pasado ? '1.5px solid #fed7aa' : '1px solid transparent' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Hasta el {c.fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', color: pasado ? '#991b1b' : urgente ? '#9a3412' : '#6b7280' }}>
                      {pasado ? `Pasó hace ${Math.abs(c.dias)} d` : c.dias === 0 ? '¡HOY!' : `En ${c.dias} días`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Nota>Si el último día cae en fin de semana, pasa al lunes. Los festivos no están contemplados. Los modelos 115 y 111 solo aparecen si has tenido gastos con retención en el último año.</Nota>
        </Tarjeta>
      )}

      {/* ───── LIBROS / EXPORTAR ───── */}
      {vista === 'libros' && (
        <Tarjeta>
          <TituloModelo>Libros · Exportar para el gestor · {ano}</TituloModelo>
          <Nota>Se abren directamente en Excel con los números bien puestos (coma decimal).</Nota>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <BotonExportar onClick={exportarLibroFacturas}>📘 Libro de facturas emitidas {ano}</BotonExportar>
            <BotonExportar onClick={exportarLibroGastos}>📕 Libro de facturas recibidas (gastos) {ano}</BotonExportar>
            <BotonExportar onClick={exportar390}>📗 Resumen anual de IVA {ano}</BotonExportar>
            {m347.declarados.length > 0 && <BotonExportar onClick={exportar347}>📙 Modelo 347 {ano}</BotonExportar>}
          </div>
        </Tarjeta>
      )}

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginTop: 16, fontSize: 12.5, color: '#92400e', lineHeight: 1.5 }}>
        ⚠️ <strong>Importante:</strong> estos cálculos son orientativos. No sustituyen a tu gestor: revísalos siempre con él antes de presentar cualquier modelo.
      </div>
    </div>
  )
}

// ─── Selector del tipo de empresa para Sociedades ───
function SelectorRegimen({ ajustes, guardar, aviso }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, margin: '12px 0' }}>
      <label style={miniLabel}>Tipo de empresa para el Impuesto sobre Sociedades {aviso && <span style={{ color: '#059669' }}>· {aviso}</span>}</label>
      <select style={{ ...selStyle, width: '100%' }} value={ajustes.regimenIS} onChange={e => guardar({ regimenIS: e.target.value })}>
        {Object.entries(REGIMENES_IS).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
      </select>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Se mira la facturación del año anterior. Las sociedades patrimoniales (solo alquilan inmuebles sin actividad) no pueden usar el de microempresa.</div>
    </div>
  )
}

// ─── Componentes visuales ───
function Tarjeta({ children }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>{children}</div>
}
function TituloModelo({ children }) {
  return <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 14, color: ROJO }}>{children}</h3>
}
function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 14, marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Fila({ label, valor, sub, subTexto, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 14, color: '#374151', fontWeight: bold ? 800 : 500 }}>{label}</span>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: bold ? 800 : 600, color: bold ? ROJO : '#111827' }}>{valor}</div>
        {sub !== undefined && <div style={{ fontSize: 11, color: '#9ca3af' }}>IVA: {sub}</div>}
        {subTexto && <div style={{ fontSize: 11, color: '#9ca3af' }}>{subTexto}</div>}
      </div>
    </div>
  )
}
function ResultadoBox({ label, valor, estado, forzarColor }) {
  const color = forzarColor || (valor >= 0 ? ROJO : '#059669')
  return (
    <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, marginTop: 14, textAlign: 'center', border: `1.5px solid ${color}22` }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{fmt(Math.abs(valor))}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 4 }}>{estado}</div>
    </div>
  )
}
function Nota({ children }) {
  return <p style={{ fontSize: 12.5, color: '#6b7280', margin: '8px 0 12px', lineHeight: 1.5 }}>{children}</p>
}
function Vacio({ children }) {
  return <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13 }}>{children}</div>
}
function BotonExportar({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 12 }}>
      {children}
    </button>
  )
}

const miniLabel = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }
const selStyle = { border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }
