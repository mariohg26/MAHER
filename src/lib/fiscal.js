// ─────────────────────────────────────────────────────────
// Cálculos fiscales de MAHER (Quesos Maher SL)
// Funciones puras, sin pantallas, para poder comprobarlas con números.
// Son ORIENTATIVOS: el gestor manda.
//
// Una SL presenta:
//   303  IVA trimestral                 (20 abr / 20 jul / 20 oct / 30 ene)
//   390  Resumen anual de IVA            (30 ene)
//   202  Pagos a cuenta de Sociedades    (20 abr / 20 oct / 20 dic)
//   200  Impuesto sobre Sociedades       (25 jul)
//   115  Retenciones de alquileres que TÚ pagas      (trimestral) + 180 anual (31 ene)
//   111  Retenciones a profesionales/trabajadores    (trimestral) + 190 anual (31 ene)
//   347  Operaciones con terceros > 3.005,06 €       (febrero)
// El 130 es de autónomos: una SL no lo presenta.
// ─────────────────────────────────────────────────────────

export const UMBRAL_347 = 3005.06

const r2 = (n) => Math.round((Number(n) || 0) * 100 + Number.EPSILON * 100) / 100

// Fecha 'YYYY-MM-DD' → { ano, mes (1-12) } sin líos de zona horaria
export function partes(fecha) {
  if (!fecha) return null
  const [a, m] = String(fecha).slice(0, 10).split('-').map(Number)
  return a && m ? { ano: a, mes: m } : null
}
export const trimestreDe = (fecha) => { const p = partes(fecha); return p ? Math.ceil(p.mes / 3) : null }
export const enAno = (fecha, ano) => partes(fecha)?.ano === ano
export const enTrimestre = (fecha, ano, trim) => { const p = partes(fecha); return !!p && p.ano === ano && Math.ceil(p.mes / 3) === trim }
// Desde el 1 de enero hasta el último día del mes indicado (incluido)
export const hastaMes = (fecha, ano, mesFin) => { const p = partes(fecha); return !!p && p.ano === ano && p.mes <= mesFin }

// ─── Totales de una factura o gasto ───
// El IVA se redondea por factura y por tipo, igual que sale impreso en la factura.
export function desglose(doc) {
  const porTipo = {}
  for (const l of doc?.lineas || []) {
    const tipo = Math.round((Number(l.iva) || 0) * 10000) / 10000
    const base = (Number(l.cant) || 0) * (Number(l.precio) || 0)
    porTipo[tipo] = (porTipo[tipo] || 0) + base
  }
  const tipos = Object.entries(porTipo).map(([tipo, base]) => {
    const t = Number(tipo)
    return { tipo: t, base: r2(base), cuota: r2(base * t) }
  }).sort((a, b) => a.tipo - b.tipo)
  const base = r2(tipos.reduce((s, x) => s + x.base, 0))
  const iva = r2(tipos.reduce((s, x) => s + x.cuota, 0))
  const retencion = r2(base * (Number(doc?.retencion_irpf) || 0))
  return { tipos, base, iva, retencion, total: r2(base + iva - retencion) }
}

// ─── IVA (303 y 390) ───
// Suma bases y cuotas por tipo de IVA de una lista de facturas/gastos
export function resumenIVA(docs) {
  const porTipo = {}
  let base = 0, cuota = 0
  for (const d of docs) {
    for (const t of desglose(d).tipos) {
      porTipo[t.tipo] = porTipo[t.tipo] || { tipo: t.tipo, base: 0, cuota: 0 }
      porTipo[t.tipo].base += t.base
      porTipo[t.tipo].cuota += t.cuota
      base += t.base; cuota += t.cuota
    }
  }
  const tipos = Object.values(porTipo).map(x => ({ ...x, base: r2(x.base), cuota: r2(x.cuota) })).sort((a, b) => b.tipo - a.tipo)
  return { tipos, base: r2(base), cuota: r2(cuota) }
}

export function calcular303({ facturas, gastos, ano, trim }) {
  const emitidas = facturas.filter(f => enTrimestre(f.fecha, ano, trim))
  const recibidas = gastos.filter(g => g.deducible !== false && enTrimestre(g.fecha, ano, trim))
  const devengado = resumenIVA(emitidas)
  const deducible = resumenIVA(recibidas)
  const resultado = r2(devengado.cuota - deducible.cuota)
  return { emitidas, recibidas, devengado, deducible, resultado }
}

export function calcular390({ facturas, gastos, ano }) {
  const emitidas = facturas.filter(f => enAno(f.fecha, ano))
  const recibidas = gastos.filter(g => g.deducible !== false && enAno(g.fecha, ano))
  const devengado = resumenIVA(emitidas)
  const deducible = resumenIVA(recibidas)
  const porTrimestre = [1, 2, 3, 4].map(t => calcular303({ facturas, gastos, ano, trim: t }).resultado)
  return { emitidas, recibidas, devengado, deducible, resultado: r2(devengado.cuota - deducible.cuota), porTrimestre }
}

// ─── Retenciones que practica la empresa (115 y 111) ───
// Gastos con retención: al 19 % suelen ser alquileres (115); el resto, profesionales (111).
export const esAlquiler = (g) => Math.abs((Number(g.retencion_irpf) || 0) - 0.19) < 0.0001 || /alquiler|arrend/i.test(g.categoria || '')
export function calcularRetencionesPracticadas({ gastos, ano, trim, proveedores = [] }) {
  const delPeriodo = gastos.filter(g => (Number(g.retencion_irpf) || 0) > 0 && (trim ? enTrimestre(g.fecha, ano, trim) : enAno(g.fecha, ano)))
  const resumen = (lista) => {
    const perceptores = {}
    let base = 0, retencion = 0
    for (const g of lista) {
      const d = desglose(g)
      base += d.base; retencion += d.retencion
      const k = g.proveedor_id || 'sin'
      perceptores[k] = perceptores[k] || { proveedor: proveedores.find(p => p.id === g.proveedor_id) || null, base: 0, retencion: 0, n: 0 }
      perceptores[k].base += d.base; perceptores[k].retencion += d.retencion; perceptores[k].n++
    }
    return {
      gastos: lista, base: r2(base), retencion: r2(retencion),
      perceptores: Object.values(perceptores).map(p => ({ ...p, base: r2(p.base), retencion: r2(p.retencion) })),
    }
  }
  return {
    m115: resumen(delPeriodo.filter(esAlquiler)),
    m111: resumen(delPeriodo.filter(g => !esAlquiler(g))),
  }
}

// ─── Modelo 347 ───
// Clientes y proveedores con más de 3.005,06 € en el año (IVA incluido).
// Se EXCLUYEN: operaciones con retención (alquileres y profesionales: ya van en 180/190),
// y operaciones con el extranjero (van en el 349 o son importaciones/exportaciones).
export function calcular347({ facturas, gastos, clientes = [], proveedores = [], ano }) {
  const extranjero = (e) => !!e?.pais && e.pais !== 'ES'
  const acumular = (docs, idCampo, entidades, tipo) => {
    const mapa = {}
    const excluidas = { conRetencion: 0, extranjero: 0 }
    for (const d of docs) {
      if (!enAno(d.fecha, ano) || !d[idCampo]) continue
      const ent = entidades.find(e => e.id === d[idCampo])
      const t = desglose(d)
      const importe = r2(t.base + t.iva)
      if ((Number(d.retencion_irpf) || 0) > 0) { excluidas.conRetencion += importe; continue }
      if (extranjero(ent)) { excluidas.extranjero += importe; continue }
      const k = d[idCampo]
      mapa[k] = mapa[k] || { entidad: ent || null, id: k, tipo, clave: tipo === 'Ventas' ? 'B' : 'A', total: 0, trimestres: [0, 0, 0, 0] }
      mapa[k].total += importe
      mapa[k].trimestres[trimestreDe(d.fecha) - 1] += importe
    }
    const lista = Object.values(mapa)
      .map(x => ({ ...x, total: r2(x.total), trimestres: x.trimestres.map(r2) }))
      .filter(x => x.total > UMBRAL_347)
      .sort((a, b) => b.total - a.total)
    return { lista, excluidas: { conRetencion: r2(excluidas.conRetencion), extranjero: r2(excluidas.extranjero) } }
  }
  // Para el 347 cuentan todas las compras, sean deducibles o no
  const ventas = acumular(facturas, 'cliente_id', clientes, 'Ventas')
  const compras = acumular(gastos, 'proveedor_id', proveedores, 'Compras')
  return {
    declarados: [...ventas.lista, ...compras.lista],
    excluidas: {
      conRetencion: r2(ventas.excluidas.conRetencion + compras.excluidas.conRetencion),
      extranjero: r2(ventas.excluidas.extranjero + compras.excluidas.extranjero),
    },
  }
}

// ─── Impuesto sobre Sociedades ───
// Tipos para periodos que empiezan en cada año (Ley 7/2024, disp. transitoria 44ª LIS)
export const REGIMENES_IS = {
  micro: { label: 'Microempresa (facturación < 1 M€)' },
  erd: { label: 'Pyme de reducida dimensión (< 10 M€)' },
  general: { label: 'Tipo general (25 %)' },
}
export function tiposIS(regimen, ano) {
  if (regimen === 'micro') {
    const t = { 2025: [0.21, 0.22], 2026: [0.19, 0.21] }[ano] || (ano >= 2027 ? [0.17, 0.20] : [0.23, 0.23])
    return { tramo1: t[0], resto: t[1], limiteTramo1: 50000 }
  }
  if (regimen === 'erd') {
    const t = { 2025: 0.24, 2026: 0.23, 2027: 0.22, 2028: 0.21 }[ano] || (ano >= 2029 ? 0.20 : 0.25)
    return { tramo1: t, resto: t, limiteTramo1: 0 }
  }
  return { tramo1: 0.25, resto: 0.25, limiteTramo1: 0 }
}
export function cuotaIS(base, regimen, ano) {
  if (base <= 0) return 0
  const t = tiposIS(regimen, ano)
  const tramo1 = Math.min(base, t.limiteTramo1)
  return r2(tramo1 * t.tramo1 + (base - tramo1) * t.resto)
}

// Cuenta de pérdidas y ganancias y estimación del Impuesto sobre Sociedades
export function calcularPyG({ facturas, gastos, ano, regimen = 'erd' }) {
  const fac = facturas.filter(f => enAno(f.fecha, ano))
  const gas = gastos.filter(g => enAno(g.fecha, ano))
  const ingresos = r2(fac.reduce((s, f) => s + desglose(f).base, 0))
  const gastosTotales = r2(gas.reduce((s, g) => s + desglose(g).base, 0))
  const gastosNoDeducibles = r2(gas.filter(g => g.deducible === false).reduce((s, g) => s + desglose(g).base, 0))
  const resultado = r2(ingresos - gastosTotales)
  const baseIS = r2(resultado + gastosNoDeducibles)
  const impuesto = cuotaIS(baseIS, regimen, ano)
  // Retenciones que te practicaron tus clientes (inquilinos): se descuentan del impuesto
  const retencionesSoportadas = r2(fac.reduce((s, f) => s + desglose(f).retencion, 0))
  return {
    ingresos, gastosTotales, gastosNoDeducibles, resultado, baseIS, impuesto,
    beneficioNeto: r2(resultado - impuesto),
    retencionesSoportadas,
    cuotaDiferencial: r2(impuesto - retencionesSoportadas),
  }
}

// ─── Modelo 202 (pagos a cuenta del Impuesto sobre Sociedades) ───
// 1P abril (ene-mar) · 2P octubre (ene-sep) · 3P diciembre (ene-nov)
export const PERIODOS_202 = [
  { p: 1, mesFin: 3, mesPago: 4, label: '1P · abril (enero-marzo)' },
  { p: 2, mesFin: 9, mesPago: 10, label: '2P · octubre (enero-septiembre)' },
  { p: 3, mesFin: 11, mesPago: 12, label: '3P · diciembre (enero-noviembre)' },
]
// Porcentaje de la modalidad de base (art. 40.3): 5/7 del tipo, redondeado por defecto
export function porcentaje202Base(regimen, ano) {
  const t = tiposIS(regimen, ano)
  return { tramo1: Math.floor(t.tramo1 * 100 * 5 / 7) / 100, resto: Math.floor(t.resto * 100 * 5 / 7) / 100, limiteTramo1: t.limiteTramo1 }
}
export function calcular202({ facturas, gastos, ano, periodo, regimen = 'erd', baseUltimoIS = 0 }) {
  // Modalidad de cuota (art. 40.2): la normal si no has optado por otra
  const modalidadCuota = r2(Math.max(0, Number(baseUltimoIS) || 0) * 0.18)

  // Modalidad de base (art. 40.3): acumulado del año
  const pct = porcentaje202Base(regimen, ano)
  const acumulado = (mesFin) => {
    const fac = facturas.filter(f => hastaMes(f.fecha, ano, mesFin))
    const gas = gastos.filter(g => hastaMes(g.fecha, ano, mesFin) && g.deducible !== false)
    const base = r2(fac.reduce((s, f) => s + desglose(f).base, 0) - gas.reduce((s, g) => s + desglose(g).base, 0))
    const retenciones = r2(fac.reduce((s, f) => s + desglose(f).retencion, 0))
    const tramo1 = Math.max(0, Math.min(base, pct.limiteTramo1))
    const bruto = base > 0 ? r2(tramo1 * pct.tramo1 + (base - tramo1) * pct.resto) : 0
    return { base, retenciones, bruto }
  }
  let pagadoAntes = 0
  const detalle = []
  for (const per of PERIODOS_202) {
    const a = acumulado(per.mesFin)
    const aPagar = r2(Math.max(0, a.bruto - a.retenciones - pagadoAntes))
    detalle.push({ ...per, ...a, pagadoAntes: r2(pagadoAntes), aPagar })
    pagadoAntes += aPagar
    if (per.p === periodo) break
  }
  return { modalidadCuota, modalidadBase: detalle[detalle.length - 1], pct, detalle }
}

// ─── Calendario fiscal de una SL ───
// Si el último día cae en fin de semana, pasa al lunes (no contempla festivos).
function aDiaHabil(d) {
  const x = new Date(d)
  if (x.getDay() === 6) x.setDate(x.getDate() + 2)
  else if (x.getDay() === 0) x.setDate(x.getDate() + 1)
  return x
}
export function calendarioFiscal(ano, { con115 = false, con111 = false, con347 = true } = {}) {
  const v = []
  const add = (a, mes, dia, label, tipo) => v.push({ fecha: aDiaHabil(new Date(a, mes - 1, dia)), label, tipo })
  for (const a of [ano - 1, ano, ano + 1]) {
    ;[[4, 1], [7, 2], [10, 3]].forEach(([mes, t]) => {
      add(a, mes, 20, `Modelo 303 · IVA ${t}T ${a}`, '303')
      if (con115) add(a, mes, 20, `Modelo 115 · Retenciones alquileres ${t}T ${a}`, '115')
      if (con111) add(a, mes, 20, `Modelo 111 · Retenciones ${t}T ${a}`, '111')
    })
    add(a + 1, 1, 30, `Modelo 303 · IVA 4T ${a}`, '303')
    add(a + 1, 1, 30, `Modelo 390 · Resumen anual IVA ${a}`, '390')
    if (con115) { add(a + 1, 1, 20, `Modelo 115 · Retenciones alquileres 4T ${a}`, '115'); add(a + 1, 1, 31, `Modelo 180 · Resumen anual alquileres ${a}`, '180') }
    if (con111) { add(a + 1, 1, 20, `Modelo 111 · Retenciones 4T ${a}`, '111'); add(a + 1, 1, 31, `Modelo 190 · Resumen anual retenciones ${a}`, '190') }
    if (con347) add(a + 1, 2, new Date(a + 1, 2, 0).getDate(), `Modelo 347 · Operaciones con terceros ${a}`, '347')
    add(a, 4, 20, `Modelo 202 · Pago a cuenta Sociedades 1P ${a}`, '202')
    add(a, 10, 20, `Modelo 202 · Pago a cuenta Sociedades 2P ${a}`, '202')
    add(a, 12, 20, `Modelo 202 · Pago a cuenta Sociedades 3P ${a}`, '202')
    add(a + 1, 7, 25, `Modelo 200 · Impuesto sobre Sociedades ${a}`, '200')
  }
  return v.sort((x, y) => x.fecha - y.fecha || x.label.localeCompare(y.label))
}

// ─── CSV para Excel en español (punto y coma, coma decimal) ───
export const csvNum = (n) => r2(n).toFixed(2).replace('.', ',')
export const csvTxt = (s) => {
  const t = String(s ?? '')
  return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
}
export const csvFecha = (d) => { const p = String(d || '').slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '' }
export const csvFila = (...celdas) => celdas.join(';') + '\n'
