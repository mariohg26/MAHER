import { useState, useEffect } from 'react'
import { useColeccion } from './hooks/useColeccion'
import {
  empresaApi, usuariosApi, facturasApi, presupuestosApi,
  gastosApi, clientesApi, proveedoresApi, miEmpresaId, crearUsuario, actualizarUsuario,
} from './lib/api'

const ROJO = '#c81019'

// Valores por defecto de la configuración (equivalente al CONFIG_INICIAL del matriz)
const CONFIG_DEFECTO = {
  logoTexto: 'MAHER',
  logoSubtexto: 'QUESOS MAHER S.L.',
  logoFuente: 'Georgia',
  colorPrincipal: '#c81019',
  estiloFactura: 'clasico',
  mostrarLogo: true,
  mostrarPieMarca: true,
  prefijoFactura: 'F',
  prefijoPresupuesto: 'P',
  reiniciarAnual: true,
  textoPie: '',
  notasFactura: 'Esta factura está exenta de timbre del Estado.',
  notasPresupuesto: 'Presupuesto válido hasta la fecha indicada.',
  tamañoTexto: 'normal',
  ivaDefecto: 0.21,
  irpfDefecto: 0,
  plazoPagoDefecto: 30,
  formaPagoDefecto: 'Transferencia bancaria',
  regimenFiscal: 'general',
  añoFiscal: new Date().getFullYear(),
  moneda: 'EUR',
  categoriasGasto: ['Suministros', 'Alquiler', 'Software/Suscripciones', 'Material de oficina', 'Transporte', 'Publicidad', 'Servicios profesionales', 'Seguros', 'Formación', 'Otros'],
}

const FORMAS_PAGO = ['Transferencia bancaria', 'Domiciliación SEPA', 'Tarjeta', 'Efectivo', 'Bizum', 'PayPal', 'Cheque', 'Pagaré']
const PRESETS_COLOR = [
  { nombre: 'Rojo MAHER', color: '#c81019' },
  { nombre: 'Azul corp.', color: '#1a56db' },
  { nombre: 'Verde', color: '#059669' },
  { nombre: 'Negro', color: '#212121' },
  { nombre: 'Morado', color: '#7c3aed' },
  { nombre: 'Naranja', color: '#ea580c' },
]

export default function Ajustes({ usuario }) {
  const [empresa, setEmpresa] = useState(null)
  const [datos, setDatos] = useState(null)        // campos fiscales (columnas)
  const [config, setConfig] = useState(null)       // JSON config
  const [cuentas, setCuentas] = useState([])
  const [seccion, setSeccion] = useState('fiscales')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    empresaApi.get()
      .then(e => {
        setEmpresa(e)
        setDatos({
          nombre: e.nombre || '', nif: e.nif || '', direccion: e.direccion || '',
          cp: e.cp || '', ciudad: e.ciudad || '', provincia: e.provincia || '',
          pais: e.pais || 'ES', telefono: e.telefono || '', email: e.email || '',
          web: e.web || '', iban: e.iban || '', swift: e.swift || '',
        })
        setConfig({ ...CONFIG_DEFECTO, ...(e.config || {}) })
        setCuentas(Array.isArray(e.cuentas_bancarias) ? e.cuentas_bancarias : [])
      })
      .catch(e => setAviso({ tipo: 'error', texto: 'Error al cargar: ' + (e.message || e) }))
      .finally(() => setCargando(false))
  }, [])

  const updDato = (k, v) => setDatos({ ...datos, [k]: v })
  const updConfig = (k, v) => setConfig({ ...config, [k]: v })

  async function guardar() {
    if (!datos.nombre.trim()) { setAviso({ tipo: 'error', texto: 'El nombre fiscal es obligatorio' }); setSeccion('fiscales'); return }
    if (!datos.nif.trim()) { setAviso({ tipo: 'error', texto: 'El NIF/CIF es obligatorio' }); setSeccion('fiscales'); return }
    setGuardando(true)
    setAviso(null)
    try {
      const actualizada = await empresaApi.update(empresa.id, {
        ...datos,
        config,
        cuentas_bancarias: cuentas,
      })
      setEmpresa(actualizada)
      setAviso({ tipo: 'ok', texto: 'Ajustes guardados correctamente' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al guardar: ' + (e.message || e) })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando ajustes…</div>
  if (!datos || !config) return <div style={{ color: '#991b1b', padding: 20 }}>No se pudieron cargar los ajustes.</div>

  const secciones = [
    ['fiscales', '🏛️', 'Datos fiscales'],
    ['bancos', '🏦', 'Cuentas bancarias'],
    ['logo', '🎨', 'Logo y marca'],
    ['numeracion', '🔢', 'Numeración'],
    ['textos', '📝', 'Textos'],
    ['defaults', '📋', 'Valores por defecto'],
    ['categorias', '📂', 'Categorías'],
    ['apariencia', '📱', 'Apariencia'],
    ['otros', '⚡', 'Otros'],
    ['backup', '💾', 'Copia de seguridad'],
    ['usuarios', '👥', 'Usuarios'],
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>⚙️ Ajustes</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>Personaliza tu empresa y el comportamiento de la app.</p>

      {aviso && <Aviso aviso={aviso} />}

      {/* Selector de sección */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
        {secciones.map(([id, icono, label]) => (
          <button key={id} onClick={() => setSeccion(id)}
            style={{
              background: seccion === id ? ROJO : '#fff',
              color: seccion === id ? '#fff' : '#374151',
              border: '1.5px solid ' + (seccion === id ? ROJO : '#e5e7eb'),
              borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{icono} {label}</button>
        ))}
      </div>

      {/* ───── DATOS FISCALES ───── */}
      {seccion === 'fiscales' && (
        <Tarjeta>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Estos datos aparecen en tus facturas y presupuestos.</p>
          <Campo label="Nombre fiscal *"><input style={inp} value={datos.nombre} onChange={e => updDato('nombre', e.target.value)} /></Campo>
          <Campo label="NIF / CIF *"><input style={inp} value={datos.nif} onChange={e => updDato('nif', e.target.value)} /></Campo>
          <Campo label="Dirección"><input style={inp} value={datos.direccion} onChange={e => updDato('direccion', e.target.value)} /></Campo>
          <div style={fila2}>
            <Campo label="Código postal"><input style={inp} value={datos.cp} onChange={e => updDato('cp', e.target.value)} /></Campo>
            <Campo label="Ciudad"><input style={inp} value={datos.ciudad} onChange={e => updDato('ciudad', e.target.value)} /></Campo>
          </div>
          <div style={fila2}>
            <Campo label="Provincia"><input style={inp} value={datos.provincia} onChange={e => updDato('provincia', e.target.value)} /></Campo>
            <Campo label="País"><input style={inp} value={datos.pais} onChange={e => updDato('pais', e.target.value)} /></Campo>
          </div>
          <div style={fila2}>
            <Campo label="Teléfono"><input style={inp} value={datos.telefono} onChange={e => updDato('telefono', e.target.value)} /></Campo>
            <Campo label="Email"><input style={inp} value={datos.email} onChange={e => updDato('email', e.target.value)} /></Campo>
          </div>
          <Campo label="Web"><input style={inp} value={datos.web} onChange={e => updDato('web', e.target.value)} /></Campo>
          <div style={fila2}>
            <Campo label="IBAN principal"><input style={inp} value={datos.iban} onChange={e => updDato('iban', e.target.value)} /></Campo>
            <Campo label="SWIFT / BIC"><input style={inp} value={datos.swift} onChange={e => updDato('swift', e.target.value)} /></Campo>
          </div>
        </Tarjeta>
      )}

      {/* ───── CUENTAS BANCARIAS ───── */}
      {seccion === 'bancos' && (
        <Tarjeta>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Cuentas bancarias</h3>
            <button onClick={() => setCuentas([...cuentas, { id: Date.now(), alias: '', banco: '', iban: '', swift: '', titular: '' }])}
              style={btnMini}>+ Añadir</button>
          </div>
          {cuentas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 14 }}>No hay cuentas. Añade una con el botón.</div>
          ) : cuentas.map((c, i) => (
            <div key={c.id || i} style={{ background: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Cuenta {i + 1}</span>
                <button onClick={() => setCuentas(cuentas.filter((_, j) => j !== i))}
                  style={{ border: 'none', background: '#fef2f2', color: '#991b1b', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Quitar</button>
              </div>
              <Campo label="Alias (ej: Cuenta principal)"><input style={inp} value={c.alias || ''} onChange={e => setCuentas(cuentas.map((x, j) => j === i ? { ...x, alias: e.target.value } : x))} /></Campo>
              <div style={fila2}>
                <Campo label="Banco"><input style={inp} value={c.banco || ''} onChange={e => setCuentas(cuentas.map((x, j) => j === i ? { ...x, banco: e.target.value } : x))} /></Campo>
                <Campo label="Titular"><input style={inp} value={c.titular || ''} onChange={e => setCuentas(cuentas.map((x, j) => j === i ? { ...x, titular: e.target.value } : x))} /></Campo>
              </div>
              <div style={fila2}>
                <Campo label="IBAN"><input style={inp} value={c.iban || ''} onChange={e => setCuentas(cuentas.map((x, j) => j === i ? { ...x, iban: e.target.value } : x))} /></Campo>
                <Campo label="SWIFT"><input style={inp} value={c.swift || ''} onChange={e => setCuentas(cuentas.map((x, j) => j === i ? { ...x, swift: e.target.value } : x))} /></Campo>
              </div>
            </div>
          ))}
        </Tarjeta>
      )}

      {/* ───── LOGO Y MARCA ───── */}
      {seccion === 'logo' && (
        <Tarjeta>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>El texto del logo aparece en la cabecera de tus facturas en PDF.</p>
          <Campo label="Texto del logo"><input style={inp} value={config.logoTexto} onChange={e => updConfig('logoTexto', e.target.value)} /></Campo>
          <Campo label="Subtexto del logo"><input style={inp} value={config.logoSubtexto} onChange={e => updConfig('logoSubtexto', e.target.value)} /></Campo>
          <Campo label="Tipo de letra del logo">
            <select style={inp} value={config.logoFuente} onChange={e => updConfig('logoFuente', e.target.value)}>
              <option value="Georgia">Georgia (serif elegante)</option>
              <option value="Helvetica">Helvetica (moderno)</option>
              <option value="Arial">Arial (limpio)</option>
            </select>
          </Campo>
          <Toggle label="Mostrar logo en la factura" checked={config.mostrarLogo} onChange={v => updConfig('mostrarLogo', v)} />
          <Toggle label="Mostrar pie de marca en la factura" checked={config.mostrarPieMarca} onChange={v => updConfig('mostrarPieMarca', v)} />
          <div style={{ marginTop: 14, padding: 16, background: '#fdf2f2', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontFamily: config.logoFuente, fontSize: 36, fontWeight: 900, color: config.colorPrincipal, letterSpacing: -1 }}>{config.logoTexto || 'MAHER'}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#828282', marginTop: 2 }}>{config.logoSubtexto}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Vista previa</div>
          </div>
        </Tarjeta>
      )}

      {/* ───── NUMERACIÓN ───── */}
      {seccion === 'numeracion' && (
        <Tarjeta>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Define cómo se numeran tus facturas y presupuestos.</p>
          <div style={fila2}>
            <Campo label="Prefijo de factura"><input style={inp} value={config.prefijoFactura} onChange={e => updConfig('prefijoFactura', e.target.value)} /></Campo>
            <Campo label="Prefijo de presupuesto"><input style={inp} value={config.prefijoPresupuesto} onChange={e => updConfig('prefijoPresupuesto', e.target.value)} /></Campo>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, fontSize: 13, color: '#6b7280' }}>
            Ejemplo: <strong style={{ color: '#111827' }}>{config.prefijoFactura}-{new Date().getFullYear()}-001</strong>
          </div>
          <div style={{ marginTop: 12 }}>
            <Toggle label="Reiniciar numeración cada año" checked={config.reiniciarAnual} onChange={v => updConfig('reiniciarAnual', v)} />
          </div>
        </Tarjeta>
      )}

      {/* ───── TEXTOS ───── */}
      {seccion === 'textos' && (
        <Tarjeta>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Textos que aparecen al pie de tus documentos.</p>
          <Campo label="Texto de pie de página (todas las facturas)">
            <input style={inp} value={config.textoPie} onChange={e => updConfig('textoPie', e.target.value)} placeholder="Ej: Gracias por su confianza" />
          </Campo>
          <Campo label="Nota en facturas">
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={config.notasFactura} onChange={e => updConfig('notasFactura', e.target.value)} />
          </Campo>
          <Campo label="Nota en presupuestos">
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={config.notasPresupuesto} onChange={e => updConfig('notasPresupuesto', e.target.value)} />
          </Campo>
        </Tarjeta>
      )}

      {/* ───── DEFAULTS ───── */}
      {seccion === 'defaults' && (
        <Tarjeta>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Valores que se rellenan automáticamente al crear facturas/clientes.</p>
          <div style={fila2}>
            <Campo label="IVA por defecto">
              <select style={inp} value={config.ivaDefecto} onChange={e => updConfig('ivaDefecto', parseFloat(e.target.value))}>
                <option value="0.21">21%</option><option value="0.10">10%</option><option value="0.04">4%</option><option value="0">0%</option>
              </select>
            </Campo>
            <Campo label="IRPF por defecto">
              <select style={inp} value={config.irpfDefecto} onChange={e => updConfig('irpfDefecto', parseFloat(e.target.value))}>
                <option value="0">Sin retención</option><option value="0.07">7%</option><option value="0.15">15%</option><option value="0.19">19%</option>
              </select>
            </Campo>
          </div>
          <div style={fila2}>
            <Campo label="Plazo de pago (días)"><input style={inp} type="number" value={config.plazoPagoDefecto} onChange={e => updConfig('plazoPagoDefecto', parseInt(e.target.value) || 0)} /></Campo>
            <Campo label="Forma de pago">
              <select style={inp} value={config.formaPagoDefecto} onChange={e => updConfig('formaPagoDefecto', e.target.value)}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Régimen fiscal">
            <select style={inp} value={config.regimenFiscal} onChange={e => updConfig('regimenFiscal', e.target.value)}>
              <option value="general">Régimen general</option>
              <option value="recargo">Recargo de equivalencia</option>
              <option value="modulos">Módulos</option>
              <option value="autonomo">Autónomo</option>
            </select>
          </Campo>
        </Tarjeta>
      )}

      {/* ───── CATEGORÍAS ───── */}
      {seccion === 'categorias' && (
        <CategoriasEditor config={config} setConfig={setConfig} />
      )}

      {/* ───── APARIENCIA ───── */}
      {seccion === 'apariencia' && (
        <Tarjeta>
          <Campo label="Color principal de la app">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {PRESETS_COLOR.map(p => (
                <button key={p.color} onClick={() => updConfig('colorPrincipal', p.color)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: config.colorPrincipal === p.color ? `2px solid ${p.color}` : '1.5px solid #e5e7eb', background: '#fff' }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.color }}></span>{p.nombre}
                </button>
              ))}
            </div>
          </Campo>
          <Campo label="Tamaño del texto">
            <select style={inp} value={config.tamañoTexto} onChange={e => updConfig('tamañoTexto', e.target.value)}>
              <option value="pequeño">Pequeño</option><option value="normal">Normal</option><option value="grande">Grande</option>
            </select>
          </Campo>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, fontSize: 12.5, color: '#1e40af', lineHeight: 1.5 }}>
            💡 El color principal se aplicará en el PDF de tus facturas. Para verlo en toda la app necesitaríamos un ajuste extra; dímelo si lo quieres.
          </div>
        </Tarjeta>
      )}

      {/* ───── OTROS ───── */}
      {seccion === 'otros' && (
        <Tarjeta>
          <div style={fila2}>
            <Campo label="Año fiscal"><input style={inp} type="number" value={config.añoFiscal} onChange={e => updConfig('añoFiscal', parseInt(e.target.value) || new Date().getFullYear())} /></Campo>
            <Campo label="Moneda">
              <select style={inp} value={config.moneda} onChange={e => updConfig('moneda', e.target.value)}>
                <option value="EUR">Euro (€)</option><option value="USD">Dólar ($)</option><option value="GBP">Libra (£)</option>
              </select>
            </Campo>
          </div>
        </Tarjeta>
      )}

      {/* ───── BACKUP ───── */}
      {seccion === 'backup' && <Backup />}

      {/* ───── USUARIOS ───── */}
      {seccion === 'usuarios' && <Usuarios usuario={usuario} />}

      {/* Botón guardar (no en backup/usuarios que se gestionan solos) */}
      {!['backup', 'usuarios'].includes(seccion) && (
        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 16, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando…' : '💾 Guardar ajustes'}
        </button>
      )}
    </div>
  )
}

// ══════════════════ CATEGORÍAS ══════════════════
function CategoriasEditor({ config, setConfig }) {
  const [nueva, setNueva] = useState('')
  const cats = config.categoriasGasto || []

  function add() {
    const t = nueva.trim()
    if (!t || cats.includes(t)) { setNueva(''); return }
    setConfig({ ...config, categoriasGasto: [...cats, t] })
    setNueva('')
  }
  function quitar(c) {
    setConfig({ ...config, categoriasGasto: cats.filter(x => x !== c) })
  }

  return (
    <Tarjeta>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Categorías para clasificar tus gastos.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input style={inp} value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Nueva categoría…"
          onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button onClick={add} style={{ border: 'none', background: ROJO, color: '#fff', borderRadius: 10, padding: '0 18px', fontWeight: 800, cursor: 'pointer' }}>Añadir</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {cats.map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', borderRadius: 20, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#475569' }}>
            {c}
            <button onClick={() => quitar(c)} style={{ border: 'none', background: 'transparent', color: '#991b1b', cursor: 'pointer', fontWeight: 800, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>
    </Tarjeta>
  )
}

// ══════════════════ BACKUP ══════════════════
function Backup() {
  const [aviso, setAviso] = useState(null)
  const [generando, setGenerando] = useState(false)

  async function exportar() {
    setGenerando(true); setAviso(null)
    try {
      const [empresa, facturas, presupuestos, gastos, clientes, proveedores] = await Promise.all([
        empresaApi.get(), facturasApi.list(), presupuestosApi.list(), gastosApi.list(), clientesApi.list(), proveedoresApi.list(),
      ])
      const data = { version: 1, fecha: new Date().toISOString(), empresa, facturas, presupuestos, gastos, clientes, proveedores }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'backup_maher_' + new Date().toISOString().split('T')[0] + '.json'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setAviso({ tipo: 'ok', texto: 'Copia de seguridad descargada. Guárdala en lugar seguro.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error al generar la copia: ' + (e.message || e) })
    } finally { setGenerando(false) }
  }

  return (
    <Tarjeta>
      {aviso && <Aviso aviso={aviso} />}
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Descargar copia de seguridad</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
        Descarga todos tus datos (facturas, presupuestos, gastos, clientes y proveedores) en un archivo. Hazlo de vez en cuando para tener tu propio respaldo.
      </p>
      <button onClick={exportar} disabled={generando}
        style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: generando ? 0.6 : 1 }}>
        {generando ? 'Generando…' : '💾 Descargar copia de seguridad (JSON)'}
      </button>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12.5, color: '#1e40af', lineHeight: 1.5 }}>
        💡 Tus datos ya están guardados de forma segura en la nube. Esta copia es un extra que te llevas tú.
      </div>
    </Tarjeta>
  )
}

// ══════════════════ USUARIOS ══════════════════
function Usuarios({ usuario }) {
  const usuarios = useColeccion(usuariosApi)
  const [form, setForm] = useState(null)         // crear nuevo
  const [editando, setEditando] = useState(null) // editar existente
  const [creando, setCreando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const esAdmin = usuario?.rol === 'admin'

  async function crear() {
    if (!form.nombre.trim() || !form.email.trim() || !form.password) { setAviso({ tipo: 'error', texto: 'Rellena nombre, email y contraseña' }); return }
    if (form.password.length < 6) { setAviso({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres' }); return }
    setCreando(true); setAviso(null)
    try {
      const empresaId = await miEmpresaId()
      await crearUsuario({ email: form.email.trim(), password: form.password, nombre: form.nombre.trim(), rol: form.rol, empresaId })
      setAviso({ tipo: 'ok', texto: 'Usuario creado. Ya puede entrar con su email y contraseña.' })
      setForm(null); usuarios.recargar()
    } catch (e) {
      const msg = (e.message || '').includes('already registered') ? 'Ese email ya está registrado.' : 'Error: ' + (e.message || e)
      setAviso({ tipo: 'error', texto: msg })
    } finally { setCreando(false) }
  }

  async function guardarEdicion() {
    if (!editando.nombre.trim()) { setAviso({ tipo: 'error', texto: 'El nombre no puede estar vacío' }); return }
    setCreando(true); setAviso(null)
    try {
      await actualizarUsuario(editando.id, { nombre: editando.nombre.trim(), rol: editando.rol, activo: editando.activo })
      setAviso({ tipo: 'ok', texto: 'Usuario actualizado' })
      setEditando(null); usuarios.recargar()
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'Error: ' + (e.message || e) })
    } finally { setCreando(false) }
  }

  return (
    <Tarjeta>
      {aviso && <Aviso aviso={aviso} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Usuarios de la empresa</h3>
        {esAdmin && !form && !editando && (
          <button onClick={() => setForm({ nombre: '', email: '', password: '', rol: 'empleado' })} style={btnMini}>+ Nuevo usuario</button>
        )}
      </div>
      {!esAdmin && <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>Solo los administradores pueden crear o editar usuarios.</p>}

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12.5, color: '#92400e', lineHeight: 1.5 }}>
        ℹ️ Al crear un usuario, podrá entrar con el email y la contraseña que le pongas. Si no puede entrar, revisa el ajuste de confirmación de email en Supabase (te lo explico en el chat).
      </div>

      {/* Formulario crear */}
      {form && (
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Nuevo usuario</div>
          <Campo label="Nombre"><input style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Campo>
          <Campo label="Email"><input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Campo>
          <Campo label="Contraseña (mínimo 6 caracteres)"><input style={inp} type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Campo>
          <Campo label="Rol">
            <select style={inp} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              <option value="empleado">Empleado</option><option value="admin">Administrador</option>
            </select>
          </Campo>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setForm(null)} disabled={creando} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={crear} disabled={creando} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: creando ? 0.6 : 1 }}>{creando ? 'Creando…' : 'Crear usuario'}</button>
          </div>
        </div>
      )}

      {/* Formulario editar */}
      {editando && (
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Editar usuario</div>
          <Campo label="Nombre"><input style={inp} value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} /></Campo>
          <Campo label="Email (no se puede cambiar)"><input style={{ ...inp, background: '#f3f4f6', color: '#9ca3af' }} value={editando.email} disabled /></Campo>
          <Campo label="Rol">
            <select style={inp} value={editando.rol} onChange={e => setEditando({ ...editando, rol: e.target.value })} disabled={editando.id === usuario?.id}>
              <option value="empleado">Empleado</option><option value="admin">Administrador</option>
            </select>
          </Campo>
          <Toggle label="Usuario activo (puede entrar)" checked={editando.activo} onChange={v => setEditando({ ...editando, activo: v })} />
          {editando.id === usuario?.id && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>No puedes cambiar tu propio rol.</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditando(null)} disabled={creando} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardarEdicion} disabled={creando} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: creando ? 0.6 : 1 }}>{creando ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {usuarios.cargando ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.items.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f9fafb', borderRadius: 10, opacity: u.activo === false ? 0.5 : 1 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nombre} {u.id === usuario?.id && <span style={{ color: '#9ca3af', fontWeight: 500 }}>(tú)</span>}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{u.email}</div>
                {u.activo === false && <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 700 }}>Desactivado</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: u.rol === 'admin' ? '#ede9fe' : '#f1f5f9', color: u.rol === 'admin' ? '#5b21b6' : '#475569', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                  {u.rol === 'admin' ? 'Administrador' : 'Empleado'}
                </span>
                {esAdmin && (
                  <button onClick={() => setEditando({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo !== false })}
                    style={{ border: 'none', background: '#eff6ff', color: '#1e40af', borderRadius: 8, padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✏️ Editar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}

// ─── Auxiliares ───
function Tarjeta({ children }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>{children}</div>
}
function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
      {children}
    </div>
  )
}
function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: ROJO }} />
      {label}
    </label>
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

const inp = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
  padding: '11px 13px', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
}
const fila2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const btnMini = { padding: '8px 14px', borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }
