import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useColeccion } from './hooks/useColeccion'
import {
  facturasApi, gastosApi, clientesApi, proveedoresApi,
  presupuestosApi, tareasApi
} from './lib/api'
import Login from './Login'
import Clientes from './Clientes'
import Proveedores from './Proveedores'
import Facturas from './Facturas'
import Presupuestos from './Presupuestos'
import Informes from './Informes'
import Ajustes from './Ajustes'
import Dashboard from './Dashboard'
import Gastos from './Gastos'
import { SECCIONES, permisosDe, NOMBRE_ROL } from './lib/permisos'

const ROJO = '#c81019'

export default function App() {
  const { usuario, cargando, error, login, logout } = useAuth()

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 42, fontWeight: 900, color: ROJO, letterSpacing: -2 }}>MAHER</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>Cargando…</div>
        </div>
      </div>
    )
  }

  if (!usuario) {
    return <Login onLogin={login} error={error} />
  }

  return <AppContent usuario={usuario} onLogout={logout} />
}

function AppContent({ usuario, onLogout }) {
  const [seccion, setSeccion] = useState('inicio')
  // Sección que debe abrir directamente su formulario de "nuevo" (botones rápidos del inicio)
  const [abrirNuevo, setAbrirNuevo] = useState(null)

  const permisos = permisosDe(usuario)
  const puedeVer = (id) => permisos.secciones.includes(id)
  // Si el rol no tiene acceso a la sección actual, volvemos al inicio
  const seccionVisible = puedeVer(seccion) ? seccion : 'inicio'
  const irA = (id) => setSeccion(puedeVer(id) ? id : 'inicio')

  function nuevoDesdeInicio(destino) {
    if (!puedeVer(destino)) return
    setAbrirNuevo(destino)
    setSeccion(destino)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "-apple-system, 'Segoe UI', sans-serif", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `3px solid ${ROJO}` }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 900, color: ROJO, letterSpacing: -1 }}>MAHER</div>
          <div style={{ fontSize: 9, color: '#828282', fontWeight: 700, letterSpacing: 0.8 }}>QUESOS MAHER SL</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <InstalarApp />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{usuario.nombre}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{NOMBRE_ROL[usuario.rol] || usuario.rol}</div>
          </div>
          <button onClick={onLogout} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Salir
          </button>
        </div>
      </div>

      {/* Menú de navegación */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 16px', display: 'flex', gap: 4, maxWidth: 900, margin: '0 auto', overflowX: 'auto' }}>
        {SECCIONES.filter(s => puedeVer(s.id)).map(s => (
          <Pestana key={s.id} activa={seccionVisible === s.id} onClick={() => setSeccion(s.id)}>{s.label}</Pestana>
        ))}
      </div>

      {!permisos.puedeCrear && (
        <div style={{ maxWidth: 900, margin: '12px auto 0', padding: '0 16px' }}>
          <div style={{ background: '#f1f5f9', color: '#475569', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>
            👁️ Modo solo consulta: puedes ver los datos, pero no crear ni cambiar nada.
          </div>
        </div>
      )}

      {/* Contenido */}
      <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
        {seccionVisible === 'inicio' && <Dashboard usuario={usuario} onNavegar={irA} onNuevo={permisos.puedeCrear ? nuevoDesdeInicio : null} verCifras={permisos.verCifras} />}
        {seccionVisible === 'facturas' && <Facturas abrirNuevo={abrirNuevo === 'facturas'} onNuevoAbierto={() => setAbrirNuevo(null)} />}
        {seccionVisible === 'presupuestos' && <Presupuestos />}
        {seccionVisible === 'gastos' && <Gastos abrirNuevo={abrirNuevo === 'gastos'} onNuevoAbierto={() => setAbrirNuevo(null)} />}
        {seccionVisible === 'clientes' && <Clientes />}
        {seccionVisible === 'proveedores' && <Proveedores />}
        {seccionVisible === 'informes' && <Informes />}
        {seccionVisible === 'ajustes' && <Ajustes usuario={usuario} />}
      </div>
    </div>
  )
}

// Botón "Instalar" para poner MAHER en la pantalla del móvil
// · Android / ordenador (Chrome, Edge): instala con un toque
// · iPhone (Safari): explica los dos pasos, porque Apple no deja hacerlo con un botón
function InstalarApp() {
  const [aviso, setAviso] = useState(null)
  const [verAyuda, setVerAyuda] = useState(false)
  const yaInstalada = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const esIPhone = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const guardar = (e) => { e.preventDefault(); setAviso(e) }
    window.addEventListener('beforeinstallprompt', guardar)
    const instalada = () => setAviso(null)
    window.addEventListener('appinstalled', instalada)
    return () => { window.removeEventListener('beforeinstallprompt', guardar); window.removeEventListener('appinstalled', instalada) }
  }, [])

  if (yaInstalada || (!aviso && !esIPhone)) return null

  async function instalar() {
    if (aviso) { aviso.prompt(); try { await aviso.userChoice } catch (e) {} setAviso(null) }
    else setVerAyuda(true)
  }

  return (
    <>
      <button onClick={instalar} style={{ background: '#fef2f2', color: ROJO, border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
        📲 Instalar
      </button>
      {verAyuda && (
        <div onClick={() => setVerAyuda(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Instalar MAHER en el iPhone</div>
            <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, margin: 0 }}>
              <li>Pulsa el botón <b>Compartir</b> de Safari (el cuadrado con la flecha hacia arriba).</li>
              <li>Elige <b>Añadir a pantalla de inicio</b> y pulsa <b>Añadir</b>.</li>
            </ol>
            <button onClick={() => setVerAyuda(false)} style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 10, border: 'none', background: ROJO, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  )
}

function Pestana({ activa, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer',
      fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
      color: activa ? ROJO : '#6b7280',
      borderBottom: activa ? `3px solid ${ROJO}` : '3px solid transparent',
      marginBottom: -1,
    }}>
      {children}
    </button>
  )
}

function Inicio({ usuario, irAClientes, irAProveedores, irAFacturas, irAGastos, irAPresupuestos }) {
  const facturas = useColeccion(facturasApi)
  const gastos = useColeccion(gastosApi)
  const clientes = useColeccion(clientesApi)
  const proveedores = useColeccion(proveedoresApi)
  const presupuestos = useColeccion(presupuestosApi)
  const tareas = useColeccion(tareasApi)

  const todoCargando = facturas.cargando || gastos.cargando || clientes.cargando

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
        ¡Hola, {usuario.nombre}! 👋
      </h2>

      <div style={{ background: '#d1fae5', border: '1.5px solid #86efac', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#065f46', marginBottom: 4 }}>✅ Conexión con Supabase funcionando</div>
        <div style={{ fontSize: 13, color: '#065f46' }}>
          Login real activo. Datos cargados correctamente desde la base de datos.
        </div>
      </div>

      {todoCargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando datos…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Tarjeta label="Facturas" valor={facturas.items.length} onClick={irAFacturas} clicable />
          <Tarjeta label="Gastos" valor={gastos.items.length} onClick={irAGastos} clicable />
          <Tarjeta label="Clientes" valor={clientes.items.length} onClick={irAClientes} clicable />
          <Tarjeta label="Proveedores" valor={proveedores.items.length} onClick={irAProveedores} clicable />
          <Tarjeta label="Presupuestos" valor={presupuestos.items.length} onClick={irAPresupuestos} clicable />
          <Tarjeta label="Tareas" valor={tareas.items.length} />
        </div>
      )}

      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 16, marginTop: 16, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
        <strong>✅ Módulo de Clientes activo.</strong> Pulsa en la pestaña "Clientes" (arriba) o en la
        tarjeta de Clientes para crear, editar y eliminar clientes. Se guardan en tu base de datos online.
      </div>
    </div>
  )
}

function Tarjeta({ label, valor, onClick, clicable }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', padding: 16, borderRadius: 14,
      border: clicable ? `1.5px solid ${ROJO}` : '1px solid #f3f4f6',
      cursor: clicable ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: ROJO, marginTop: 4 }}>{valor}</div>
      {clicable && <div style={{ fontSize: 11, color: ROJO, fontWeight: 700, marginTop: 2 }}>Abrir →</div>}
    </div>
  )
}
