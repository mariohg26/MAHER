// ─────────────────────────────────────────────────────────
// PDF de facturas y presupuestos
// Genera un PDF de verdad (archivo .pdf) con jsPDF, listo para
// ver, descargar o compartir (WhatsApp, email…) con un toque.
// ─────────────────────────────────────────────────────────

const ROJO = [200, 16, 25]       // #c81019
const ROJO_SUAVE = [253, 242, 242]
const GRIS = [110, 110, 110]
const NEGRO = [26, 26, 26]

// Datos fiscales por defecto (si en Ajustes no hay otros)
const EMPRESA = {
  nombre: 'QUESOS MAHER SL',
  nif: 'B37267259',
  direccion: 'Cl Cañón de Rio Lobos, 47-49 P.I.El Montalvo II',
  cp: '37008',
  ciudad: 'SALAMANCA',
  provincia: 'Salamanca',
}

const fmt = (n) => (Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
const fmtNum = (n) => {
  const x = Number(n) || 0
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace('.', ',')
}
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—'

// Las fuentes básicas del PDF solo saben dibujar los caracteres "occidentales"
// (WinAnsi). Cualquier otro (signo menos tipográfico, emojis…) sale como
// basura y además descuadra el texto, así que lo cambiamos o lo quitamos.
const EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const SUSTITUTOS = { '−': '-', '‐': '-', '‑': '-', '‒': '-', '―': '-', '′': "'", '″': '"', '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ' }
function limpiar(texto) {
  return String(texto ?? '').replace(/./gsu, ch => {
    if (SUSTITUTOS[ch]) return SUSTITUTOS[ch]
    const c = ch.codePointAt(0)
    if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || EXTRA_WINANSI.includes(ch)) return ch
    return ''
  })
}

function calcTotales(doc) {
  const lineas = doc.lineas || []
  const base = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0)
  const iva = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0) * (Number(l.iva) || 0), 0)
  const irpf = base * (Number(doc.retencion_irpf) || 0)
  return { base, iva, irpf, total: base + iva - irpf }
}

// Base y cuota por cada tipo de IVA (4 %, 10 %, 21 %…)
function desgloseIVA(doc) {
  const tipos = {}
  ;(doc.lineas || []).forEach(l => {
    const tipo = Number(l.iva) || 0
    const base = (Number(l.cant) || 0) * (Number(l.precio) || 0)
    if (!tipos[tipo]) tipos[tipo] = { tipo, base: 0, cuota: 0 }
    tipos[tipo].base += base
    tipos[tipo].cuota += base * tipo
  })
  return Object.values(tipos).sort((a, b) => a.tipo - b.tipo)
}

function direccionCliente(c) {
  if (!c) return ''
  const partes = [c.direccion, c.cp && c.ciudad ? c.cp + ' ' + c.ciudad : (c.cp || c.ciudad), c.provincia, c.pais && c.pais !== 'ES' ? c.pais : null].filter(Boolean)
  return partes.join(', ')
}

function datosEmpresa(e) {
  if (!e || !e.nombre) return { ...EMPRESA }
  return {
    nombre: e.nombre, nif: e.nif || EMPRESA.nif, direccion: e.direccion || EMPRESA.direccion,
    cp: e.cp || EMPRESA.cp, ciudad: e.ciudad || EMPRESA.ciudad, provincia: e.provincia || '',
    telefono: e.telefono || '', email: e.email || '',
  }
}

export function nombreArchivoPDF(doc, cliente) {
  const tipo = (doc._tipo || 'FACTURA') === 'PRESUPUESTO' ? 'Presupuesto' : 'Factura'
  const cli = (cliente?.razon_social || '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40)
  return `${tipo} ${doc.id || ''}${cli ? ' - ' + cli : ''}.pdf`.replace(/\s+/g, ' ')
}

// ─── Construye el PDF y devuelve un Blob ───
export async function generarPDFFactura(doc, cliente, opciones = {}) {
  const [{ jsPDF }, modTabla] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  // La librería se exporta de forma distinta según el empaquetador: buscamos la función
  const candidatas = [modTabla.autoTable, modTabla.default, modTabla.default?.default, modTabla.default?.autoTable]
  const autoTable = candidatas.find(f => typeof f === 'function')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  // Todo lo que se escribe en el PDF pasa por el filtro de caracteres
  const textoOriginal = pdf.text.bind(pdf)
  pdf.text = (t, ...resto) => textoOriginal(Array.isArray(t) ? t.map(limpiar) : limpiar(t), ...resto)
  const partirOriginal = pdf.splitTextToSize.bind(pdf)
  pdf.splitTextToSize = (t, ...resto) => partirOriginal(limpiar(t), ...resto)
  const W = 210, M = 15, DER = W - M

  const emp = datosEmpresa(opciones.empresa)
  const config = opciones.empresa?.config || {}
  const tipoDoc = doc._tipo || 'FACTURA'
  const esPresupuesto = tipoDoc === 'PRESUPUESTO'
  const totales = calcTotales(doc)
  const cuenta = opciones.cuenta || null

  const color = (c) => pdf.setTextColor(c[0], c[1], c[2])

  // ── Cabecera: logo y datos de la empresa ──
  pdf.setFont('times', 'bold'); pdf.setFontSize(32); color(ROJO)
  pdf.text('MAHER', M, 25)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); color(GRIS)
  pdf.text('QUESOS MAHER SL', M + 0.5, 30.5, { charSpace: 0.6 })

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); color(NEGRO)
  pdf.text(emp.nombre, DER, 17, { align: 'right' })
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); color(GRIS)
  const lineasEmp = [
    'CIF: ' + emp.nif,
    emp.direccion,
    [emp.cp, emp.ciudad].filter(Boolean).join(' ') + (emp.provincia && emp.provincia.toUpperCase() !== String(emp.ciudad).toUpperCase() ? ' (' + emp.provincia + ')' : ''),
    [emp.telefono, emp.email].filter(Boolean).join(' · '),
  ].filter(Boolean)
  lineasEmp.forEach((t, i) => pdf.text(t, DER, 21.5 + i * 4, { align: 'right' }))

  pdf.setDrawColor(ROJO[0], ROJO[1], ROJO[2]); pdf.setLineWidth(0.8)
  pdf.line(M, 38, DER, 38)

  // ── Título y fechas ──
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); color(NEGRO)
  pdf.text(tipoDoc, M, 51)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); color(GRIS)
  pdf.text('Nº ' + (doc.id || '—'), M, 57)

  const cajaFecha = (x, etiqueta, valor) => {
    pdf.setFillColor(ROJO_SUAVE[0], ROJO_SUAVE[1], ROJO_SUAVE[2])
    pdf.roundedRect(x, 44, 38, 15, 1.5, 1.5, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); color(ROJO)
    pdf.text(etiqueta, x + 4, 49.5)
    pdf.setFontSize(11); color(NEGRO)
    pdf.text(valor, x + 4, 55.5)
  }
  cajaFecha(DER - 80, 'FECHA', fmtDate(doc.fecha))
  if (doc.vencimiento) cajaFecha(DER - 38, esPresupuesto ? 'VÁLIDO HASTA' : 'VENCIMIENTO', fmtDate(doc.vencimiento))

  // ── Cliente y forma de pago ──
  let y = 72
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); color(ROJO)
  pdf.text(esPresupuesto ? 'PRESUPUESTO PARA' : 'FACTURAR A', M, y)
  pdf.setFontSize(11.5); color(NEGRO)
  const nombreCli = pdf.splitTextToSize(cliente?.razon_social || '—', 100)
  pdf.text(nombreCli, M, y + 6)
  let yCli = y + 6 + nombreCli.length * 5
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); color(GRIS)
  const datosCli = [
    cliente?.nif ? 'NIF/CIF: ' + cliente.nif : null,
    ...(direccionCliente(cliente) ? pdf.splitTextToSize(direccionCliente(cliente), 100) : []),
    cliente?.email || null,
    cliente?.telefono || null,
  ].filter(Boolean)
  datosCli.forEach(t => { pdf.text(t, M, yCli); yCli += 4.2 })

  let yPago = y
  const xPago = 125
  const formaPago = cliente?.forma_pago || doc.forma_pago || ''
  const iban = cuenta?.iban || ''
  const banco = cuenta?.banco || cuenta?.alias || ''
  if (formaPago || iban) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); color(ROJO)
    pdf.text('FORMA DE PAGO', xPago, yPago)
    yPago += 6
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); color(NEGRO)
    if (formaPago) { pdf.text(formaPago, xPago, yPago); yPago += 4.5 }
    if (iban) {
      if (banco) { color(GRIS); pdf.text(banco, xPago, yPago); yPago += 4.2 }
      pdf.setFont('helvetica', 'bold'); color(NEGRO)
      pdf.text('IBAN ' + iban, xPago, yPago); yPago += 4.2
    }
  }

  // ── Líneas ──
  autoTable(pdf, {
    startY: Math.max(yCli, yPago) + 6,
    margin: { left: M, right: M, bottom: 22 },
    head: [['Descripción', 'Cant.', 'Precio', 'IVA', 'Importe']],
    body: (doc.lineas || []).map(l => [
      limpiar(l.desc || ''),
      fmtNum(l.cant),
      fmt(l.precio),
      Math.round((Number(l.iva) || 0) * 100) + ' %',
      fmt((Number(l.cant) || 0) * (Number(l.precio) || 0)),
    ]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: NEGRO, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
    headStyles: { fillColor: ROJO, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 16 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
    didParseCell: (d) => { if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right' },
  })

  y = pdf.lastAutoTable.finalY + 8
  if (y > 225) { pdf.addPage(); y = 25 }

  // ── Desglose de IVA (izquierda) ──
  const desglose = desgloseIVA(doc)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); color(ROJO)
  pdf.text('DESGLOSE DE IVA', M, y)
  let yD = y + 5
  pdf.setFontSize(7.5); color(GRIS)
  pdf.text('Base', M, yD); pdf.text('Tipo', M + 38, yD); pdf.text('Cuota', M + 75, yD, { align: 'right' })
  pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.2); pdf.line(M, yD + 1.5, M + 75, yD + 1.5)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); color(NEGRO)
  desglose.forEach(d => {
    yD += 5
    pdf.text(fmt(d.base), M, yD)
    pdf.text(Math.round(d.tipo * 100) + ' %', M + 38, yD)
    pdf.text(fmt(d.cuota), M + 75, yD, { align: 'right' })
  })

  // ── Totales (derecha) ──
  const xT = DER - 70
  let yT = y - 1
  const filaTotal = (etq, val, rojo) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); color(rojo ? ROJO : GRIS)
    pdf.text(etq, xT + 3, yT + 4)
    pdf.setFont('helvetica', 'bold'); color(rojo ? ROJO : NEGRO)
    pdf.text(val, DER - 3, yT + 4, { align: 'right' })
    yT += 6
  }
  filaTotal('Base imponible', fmt(totales.base))
  filaTotal('IVA', fmt(totales.iva))
  if (totales.irpf > 0) filaTotal(`Retención IRPF (${Math.round((Number(doc.retencion_irpf) || 0) * 100)} %)`, '- ' + fmt(totales.irpf), true)
  pdf.setFillColor(ROJO[0], ROJO[1], ROJO[2])
  pdf.roundedRect(xT, yT + 1, 70, 11, 1.5, 1.5, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(255, 255, 255)
  pdf.text('TOTAL', xT + 4, yT + 8.2)
  pdf.setFontSize(13)
  pdf.text(fmt(totales.total), DER - 4, yT + 8.5, { align: 'right' })
  yT += 14

  y = Math.max(yD, yT) + 10

  // ── Observaciones y notas ──
  const bloqueTexto = (titulo, texto) => {
    if (!texto) return
    const lineas = pdf.splitTextToSize(String(texto), W - 2 * M)
    if (y + 6 + lineas.length * 4 > 272) { pdf.addPage(); y = 25 }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); color(ROJO)
    pdf.text(titulo, M, y)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); color(NEGRO)
    pdf.text(lineas, M, y + 4.5)
    y += 8 + lineas.length * 4
  }
  bloqueTexto('OBSERVACIONES', doc.notas)
  const notaFija = esPresupuesto ? config.notasPresupuesto : config.notasFactura
  if (notaFija) {
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7.5); color(GRIS)
    const l = pdf.splitTextToSize(notaFija, W - 2 * M)
    if (y + l.length * 3.5 > 272) { pdf.addPage(); y = 25 }
    pdf.text(l, M, y)
  }

  // ── Pie en todas las páginas ──
  const paginas = pdf.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p)
    pdf.setDrawColor(ROJO[0], ROJO[1], ROJO[2]); pdf.setLineWidth(0.4)
    pdf.line(M, 280, DER, 280)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); color(GRIS)
    pdf.text(`${emp.nombre} · CIF ${emp.nif} · ${emp.direccion} · ${emp.cp} ${emp.ciudad}`, M, 285)
    if (config.textoPie) pdf.text(pdf.splitTextToSize(config.textoPie, 150), M, 289)
    pdf.text(`Página ${p} de ${paginas}`, DER, 285, { align: 'right' })
  }

  pdf.setProperties({ title: `${tipoDoc} ${doc.id || ''}`, author: emp.nombre, creator: 'MAHER' })
  return pdf.output('blob')
}

// ¿El navegador deja compartir archivos? (móvil: sí; ordenador: depende)
export function puedeCompartirArchivos() {
  try {
    const f = new File(['x'], 'prueba.pdf', { type: 'application/pdf' })
    return !!(navigator.canShare && navigator.canShare({ files: [f] }))
  } catch (e) { return false }
}

// ─── Descargar el archivo directamente ───
export async function descargarPDFFactura(doc, cliente, opciones = {}) {
  const blob = await generarPDFFactura(doc, cliente, opciones)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivoPDF(doc, cliente)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// ─── Compartir (WhatsApp, email…). Si no se puede, descarga ───
export async function compartirPDFFactura(doc, cliente, opciones = {}) {
  const blob = await generarPDFFactura(doc, cliente, opciones)
  const nombre = nombreArchivoPDF(doc, cliente)
  const archivo = new File([blob], nombre, { type: 'application/pdf' })
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre.replace(/\.pdf$/, '') })
      return 'compartido'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelado'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return 'descargado'
}

// ─── Ver el PDF en una pestaña nueva ───
// (se abre la pestaña antes de generar el PDF para que el navegador no la bloquee)
export async function abrirPDFFactura(doc, cliente, opciones = {}) {
  const ventana = window.open('', '_blank')
  if (ventana) {
    try { ventana.document.write('<p style="font-family:sans-serif;padding:24px;color:#6b7280">Preparando el PDF…</p>') } catch (e) {}
  }
  try {
    const blob = await generarPDFFactura(doc, cliente, opciones)
    const url = URL.createObjectURL(blob)
    if (ventana) ventana.location.href = url
    else {
      // Ventanas emergentes bloqueadas: lo descargamos
      const a = document.createElement('a')
      a.href = url; a.download = nombreArchivoPDF(doc, cliente)
      document.body.appendChild(a); a.click(); a.remove()
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (e) {
    if (ventana) ventana.close()
    alert('No se pudo generar el PDF: ' + (e.message || e))
  }
}
