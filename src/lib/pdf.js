// ─────────────────────────────────────────────────────────
// Generador de PDF de facturas — abre una ventana imprimible
// (sin librerías externas; el usuario imprime o guarda como PDF)
// ─────────────────────────────────────────────────────────

const ROJO = '#c81019'

// Datos fiscales de la empresa (Quesos Maher SL)
const EMPRESA = {
  nombre: 'QUESOS MAHER SL',
  nif: 'B37267259',
  direccion: 'Cl Cañón de Rio Lobos, 47-49 P.I.El Montalvo II',
  cp: '37008',
  ciudad: 'SALAMANCA',
  provincia: 'Salamanca',
}

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—'

function calcTotales(doc) {
  const lineas = doc.lineas || []
  const base = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0), 0)
  const iva = lineas.reduce((s, l) => s + (Number(l.cant) || 0) * (Number(l.precio) || 0) * (Number(l.iva) || 0), 0)
  const irpf = base * (Number(doc.retencion_irpf) || 0)
  return { base, iva, irpf, total: base + iva - irpf }
}

function direccionCliente(c) {
  if (!c) return ''
  const partes = [c.direccion, c.cp && c.ciudad ? c.cp + ' ' + c.ciudad : (c.cp || c.ciudad), c.provincia, c.pais && c.pais !== 'ES' ? c.pais : null].filter(Boolean)
  return partes.join(', ')
}

export function abrirPDFFactura(doc, cliente) {
  const totales = calcTotales(doc)
  const dir = direccionCliente(cliente)
  const tipoDoc = doc._tipo || 'FACTURA'

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipoDoc} ${doc.id} - ${EMPRESA.nombre}</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 16px; line-height: 1.4; font-size: 12px; }
.top-bar { height: 6px; background: ${ROJO}; margin-bottom: 20px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid ${ROJO}; }
.logo { font-family: Georgia, serif; font-size: 44px; font-weight: 900; color: ${ROJO}; letter-spacing: -1.5px; line-height: 1; }
.sub-logo { font-size: 9px; margin-top: 4px; font-weight: 700; letter-spacing: 1px; color: #828282; }
.empresa-info { text-align: right; font-size: 10px; color: #4b4b4b; line-height: 1.6; }
.titulo-doc { display: flex; justify-content: space-between; align-items: flex-start; margin: 24px 0 22px; }
.titulo-doc h1 { font-family: Georgia, serif; font-size: 28px; color: ${ROJO}; letter-spacing: -1px; }
.titulo-doc .num { font-size: 13px; font-weight: 700; margin-top: 2px; }
.fecha-box { background: #fdf2f2; border: 1.5px solid ${ROJO}; border-radius: 4px; padding: 8px 14px; text-align: right; }
.fecha-box .lbl { font-size: 8px; color: ${ROJO}; font-weight: 800; text-transform: uppercase; }
.fecha-box .val { font-size: 13px; font-weight: 800; margin-top: 2px; }
.fecha-box .sub { font-size: 9px; color: #828282; margin-top: 3px; }
.cliente { margin-bottom: 20px; }
.cliente-label { font-size: 10px; color: ${ROJO}; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid ${ROJO}; padding-bottom: 3px; display: inline-block; margin-bottom: 6px; }
.cliente-nombre { font-family: Georgia, serif; font-weight: 800; font-size: 16px; }
.cliente-datos { font-size: 11px; color: #4b4b4b; margin-top: 5px; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
thead { background: ${ROJO}; color: #fff; }
thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; }
thead th.r { text-align: right; }
tbody tr:nth-child(odd) { background: #fdf2f2; }
tbody td { padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
tbody td.r { text-align: right; }
tbody td.b { font-weight: 700; }
tbody tr:last-child td { border-bottom: 2px solid ${ROJO}; }
.bottom { display: flex; justify-content: space-between; gap: 16px; }
.info-pago { flex: 1; padding: 12px; background: #fdf2f2; border-left: 3px solid ${ROJO}; font-size: 10px; }
.info-pago-title { font-weight: 800; color: ${ROJO}; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }
.totales { width: 240px; background: #fdf2f2; border: 1.5px solid ${ROJO}; border-radius: 4px; padding: 12px; }
.tr { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; color: #4b4b4b; }
.tr span:last-child { color: #1a1a1a; font-weight: 600; }
.tr.irpf span { color: ${ROJO}; }
.tr.total { background: ${ROJO}; color: #fff; padding: 10px 14px; margin-top: 8px; border-radius: 4px; font-family: Georgia, serif; font-size: 15px; font-weight: 900; }
.tr.total span { color: #fff !important; font-weight: 900 !important; }
.pie { margin-top: 30px; padding-top: 12px; border-top: 2px solid ${ROJO}; text-align: center; }
.pie-logo { font-family: Georgia, serif; font-size: 14px; font-weight: 900; color: ${ROJO}; }
.pie-info { font-size: 9px; color: #828282; margin-top: 3px; }
.actions { position: fixed; bottom: 20px; right: 20px; z-index: 100; display: flex; gap: 10px; }
.actions button { color: #fff; border: none; padding: 14px 22px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.btn-imprimir { background: #374151; }
.btn-descargar { background: ${ROJO}; }
.aviso-descarga { position: fixed; bottom: 76px; right: 20px; background: #1f2937; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 12px; max-width: 260px; z-index: 100; line-height: 1.4; box-shadow: 0 4px 12px rgba(0,0,0,0.25); }
@media print { .actions, .aviso-descarga { display: none !important; } }
</style></head><body>
<div class="aviso-descarga" id="avisoDesc" style="display:none">Para <b>descargar el PDF</b>: en la ventana de impresión, elige como destino <b>"Guardar como PDF"</b>.</div>
<div class="actions">
  <button class="btn-imprimir" onclick="window.print()">🖨️ Imprimir</button>
  <button class="btn-descargar" onclick="descargarPDF()">📥 Descargar PDF</button>
</div>
<script>
  function descargarPDF() {
    var a = document.getElementById('avisoDesc');
    if (a) a.style.display = 'block';
    setTimeout(function(){ window.print(); }, 400);
  }
</script>
<div class="top-bar"></div>
<div class="header">
  <div>
    <div class="logo">MAHER</div>
    <div class="sub-logo">QUESOS MAHER SL</div>
  </div>
  <div class="empresa-info">
    <div>C.I.F.: ${EMPRESA.nif}</div>
    <div>${EMPRESA.direccion}</div>
    <div>${EMPRESA.cp} ${EMPRESA.ciudad}</div>
  </div>
</div>
<div class="titulo-doc">
  <div><h1>${tipoDoc}</h1><div class="num">Nº ${doc.id}</div></div>
  <div class="fecha-box">
    <div class="lbl">Fecha emisión</div><div class="val">${fmtDate(doc.fecha)}</div>
    <div class="sub">Vence: ${fmtDate(doc.vencimiento)}</div>
  </div>
</div>
<div class="cliente">
  <div class="cliente-label">Facturar a</div>
  <div class="cliente-nombre">${cliente?.razon_social || '—'}</div>
  <div class="cliente-datos">
    <div>NIF/CIF: ${cliente?.nif || '—'}</div>
    ${dir ? '<div>' + dir + '</div>' : ''}
    ${cliente?.email ? '<div>' + cliente.email + '</div>' : ''}
  </div>
</div>
<table>
  <thead><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">IVA</th><th class="r">Subtotal</th></tr></thead>
  <tbody>
    ${(doc.lineas || []).map(l => '<tr><td>' + (l.desc || '') + '</td><td class="r">' + l.cant + '</td><td class="r">' + fmt(l.precio) + '</td><td class="r">' + Math.round((l.iva || 0) * 100) + '%</td><td class="r b">' + fmt((l.cant || 0) * (l.precio || 0)) + '</td></tr>').join('')}
  </tbody>
</table>
<div class="bottom">
  <div class="info-pago">
    <div class="info-pago-title">Información de pago</div>
    ${cliente?.forma_pago ? '<div>Forma de pago: ' + cliente.forma_pago + '</div>' : ''}
    ${cliente?.plazo_pago > 0 ? '<div>Plazo: ' + cliente.plazo_pago + ' días</div>' : ''}
    ${cliente?.iban ? '<div><strong>IBAN:</strong> ' + cliente.iban + '</div>' : ''}
  </div>
  <div class="totales">
    <div class="tr"><span>Base imponible</span><span>${fmt(totales.base)}</span></div>
    <div class="tr"><span>IVA</span><span>${fmt(totales.iva)}</span></div>
    ${totales.irpf > 0 ? `<div class="tr irpf"><span>Retenciones (${Math.round((doc.retencion_irpf || 0) * 100)}%)</span><span>−${fmt(totales.irpf)}</span></div>` : ''}
    <div class="tr total"><span>TOTAL</span><span>${fmt(totales.total)}</span></div>
  </div>
</div>
<div class="pie">
  <div class="pie-logo">MAHER</div>
  <div class="pie-info">${EMPRESA.nombre} · NIF: ${EMPRESA.nif}</div>
</div>
</body></html>`

  const ventana = window.open('', '_blank')
  if (ventana) {
    ventana.document.write(html)
    ventana.document.close()
  } else {
    alert('El navegador ha bloqueado la ventana del PDF. Permite las ventanas emergentes para este sitio.')
  }
}
