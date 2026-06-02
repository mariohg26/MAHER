import { useAuth } from './hooks/useAuth'
import { useColeccion } from './hooks/useColeccion'
import {
  facturasApi, gastosApi, clientesApi, proveedoresApi,
  presupuestosApi, tareasApi, usuariosApi
} from './lib/api'
import Login from './Login'

const ROJO = '#c81019'

export default function App() {
  const { usuario, cargando, error, login, logout } = useAuth()

  // Pantalla de carga inicial
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

  // Si no hay sesión, mostrar login
  if (!usuario) {
    return <Login onLogin={login} error={error} />
  }

  // Usuario autenticado → app principal
  return <AppContent usuario={usuario} onLogout={logout} />
}

function AppContent({ usuario, onLogout }) {
  // Carga de datos desde Supabase
  const facturas = useColeccion(facturasApi)
  const gastos = useColeccion(gastosApi)
  const clientes = useColeccion(clientesApi)
  const proveedores = useColeccion(proveedoresApi)
  const presupuestos = useColeccion(presupuestosApi)
  const tareas = useColeccion(tareasApi)

  const todoCargando = facturas.cargando || gastos.cargando || clientes.cargando

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "-apple-system, 'Segoe UI', sans-serif", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `3px solid ${ROJO}` }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 900, color: ROJO, letterSpacing: -1 }}>MAHER</div>
          <div style={{ fontSize: 9, color: '#828282', fontWeight: 700, letterSpacing: 0.8 }}>QUESOS MAHER SL</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{usuario.nombre}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{usuario.rol}</div>
          </div>
          <button onClick={onLogout} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Salir
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
        {todoCargando ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando datos…</div>
        ) : (
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

            {/* Resumen rápido de datos cargados */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Tarjeta label="Facturas" valor={facturas.items.length} />
              <Tarjeta label="Gastos" valor={gastos.items.length} />
              <Tarjeta label="Clientes" valor={clientes.items.length} />
              <Tarjeta label="Proveedores" valor={proveedores.items.length} />
              <Tarjeta label="Presupuestos" valor={presupuestos.items.length} />
              <Tarjeta label="Tareas" valor={tareas.items.length} />
            </div>

            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 16, marginTop: 16, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
              <strong>📌 Siguiente paso:</strong> aquí iremos conectando los módulos completos
              (facturas, gastos, informes, etc.) que ya tienes en <code>maher-v6.jsx</code>,
              adaptándolos uno a uno para que lean y escriban en Supabase en vez de localStorage.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Tarjeta({ label, valor }) {
  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 14, border: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: ROJO, marginTop: 4 }}>{valor}</div>
    </div>
  )
}
