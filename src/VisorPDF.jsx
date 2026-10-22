import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────
// Visor de PDF dentro de la app
// Enseña el PDF sin salir de MAHER (en el móvil, salir a otra app
// hace que Android cierre la página y haya que volver a empezar).
// Se abre con abrirVisorPDF() desde lib/pdf.js.
// ─────────────────────────────────────────────────────────

const ROJO = '#c81019'

export default function VisorPDF() {
  const [pdf, setPdf] = useState(null) // { blob, nombre }

  useEffect(() => {
    const abrir = (e) => setPdf(e.detail)
    window.addEventListener('maher-ver-pdf', abrir)
    window.__maherVisorListo = true
    return () => { window.removeEventListener('maher-ver-pdf', abrir); window.__maherVisorListo = false }
  }, [])

  // El botón "atrás" del móvil cierra el visor en vez de salir de la app
  useEffect(() => {
    if (!pdf) return
    history.pushState({ visorPDF: true }, '')
    const atras = () => setPdf(null)
    window.addEventListener('popstate', atras)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', atras)
      document.body.style.overflow = ''
      if (history.state?.visorPDF) history.back()
    }
  }, [pdf])

  if (!pdf) return null
  return <Visor pdf={pdf} onCerrar={() => setPdf(null)} />
}

function Visor({ pdf, onCerrar }) {
  const contenedor = useRef(null)
  const [estado, setEstado] = useState('cargando') // cargando | listo | error
  const [paginas, setPaginas] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [aviso, setAviso] = useState('')
  const sePuedeCompartir = puedeCompartir(pdf)

  useEffect(() => {
    let cancelado = false
    let documento = null
    async function pintar() {
      try {
        setEstado('cargando')
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs')
        const { default: urlWorker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = urlWorker
        const datos = new Uint8Array(await pdf.blob.arrayBuffer())
        documento = await pdfjs.getDocument({ data: datos }).promise
        if (cancelado) return
        setPaginas(documento.numPages)
        const caja = contenedor.current
        caja.innerHTML = ''
        const ancho = Math.min(caja.clientWidth - 24, 900) * zoom
        const nitidez = Math.min(window.devicePixelRatio || 1, 2.5)
        for (let n = 1; n <= documento.numPages; n++) {
          const pagina = await documento.getPage(n)
          if (cancelado) return
          const base = pagina.getViewport({ scale: 1 })
          const escala = ancho / base.width
          const vista = pagina.getViewport({ scale: escala * nitidez })
          const lienzo = document.createElement('canvas')
          lienzo.width = Math.floor(vista.width)
          lienzo.height = Math.floor(vista.height)
          lienzo.style.cssText = `width:${Math.floor(ancho)}px;height:${Math.floor(base.height * escala)}px;display:block;margin:0 auto 12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25);border-radius:2px`
          caja.appendChild(lienzo)
          await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise
        }
        if (!cancelado) setEstado('listo')
      } catch (e) {
        console.error('Visor PDF:', e)
        if (!cancelado) setEstado('error')
      }
    }
    pintar()
    return () => { cancelado = true; try { documento?.destroy() } catch (e) {} }
  }, [pdf, zoom])

  function descargar() {
    const url = URL.createObjectURL(pdf.blob)
    const a = document.createElement('a')
    a.href = url; a.download = pdf.nombre
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    setAviso('Descargado: lo tienes en la carpeta de descargas')
    setTimeout(() => setAviso(''), 3500)
  }

  async function compartir() {
    try {
      const archivo = new File([pdf.blob], pdf.nombre, { type: 'application/pdf' })
      await navigator.share({ files: [archivo], title: pdf.nombre.replace(/\.pdf$/, '') })
    } catch (e) { /* cancelado */ }
  }

  const btn = { border: 'none', borderRadius: 10, padding: '9px 11px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#4b5563', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', padding: '8px 10px', borderBottom: `3px solid ${ROJO}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onCerrar} style={{ ...btn, background: '#f3f4f6', color: '#111827' }}>✕ Cerrar</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setZoom(zoom === 1 ? 1.8 : 1)} style={{ ...btn, background: '#f3f4f6', color: '#111827', padding: '10px' }} aria-label="Zoom">{zoom === 1 ? '🔍+' : '🔍−'}</button>
          <button onClick={descargar} style={{ ...btn, background: '#eff6ff', color: '#1e40af' }}>📥 Descargar</button>
          {sePuedeCompartir && <button onClick={compartir} style={{ ...btn, background: '#166534', color: '#fff' }}>📤 Enviar</button>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pdf.nombre.replace(/\.pdf$/, '')}{paginas > 1 ? ` · ${paginas} págs.` : ''}
        </div>
      </div>
      {aviso && <div style={{ background: '#d1fae5', color: '#065f46', fontSize: 13, fontWeight: 700, padding: '8px 12px', textAlign: 'center' }}>{aviso}</div>}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 12px 30px' }}>
        {estado === 'cargando' && <div style={{ color: '#fff', textAlign: 'center', padding: 40, fontWeight: 700 }}>Preparando el PDF…</div>}
        {estado === 'error' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>No se ha podido enseñar aquí</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>El PDF está bien: puedes descargarlo o enviarlo con los botones de arriba.</div>
          </div>
        )}
        <div ref={contenedor} style={{ minWidth: zoom > 1 ? 'max-content' : undefined }} />
      </div>
    </div>
  )
}

function puedeCompartir(pdf) {
  try {
    const f = new File([pdf.blob], pdf.nombre, { type: 'application/pdf' })
    return !!(navigator.canShare && navigator.canShare({ files: [f] }))
  } catch (e) { return false }
}
