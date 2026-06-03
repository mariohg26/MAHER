import { useState } from 'react'
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
import Gastos from './Gastos'

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

      {/* Menú de navegación */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 16px', display: 'flex', gap: 4, maxWidth: 900, margin: '0 auto' }}>
        <Pestana activa={seccion === 'inicio'} onClick={() => setSeccion('inicio')}>Inicio</Pestana>
        <Pestana activa={seccion === 'facturas'} onClick={() => setSeccion('facturas')}>Facturas</Pestana>
        <Pestana activa={seccion === 'presupuestos'} onClick={() => setSeccion('presupuestos')}>Presupuestos</Pestana>
        <Pestana activa={seccion === 'gastos'} onClick={() => setSeccion('gastos')}>Gastos</Pestana>
        <Pestana activa={seccion === 'clientes'} onClick={() => setSeccion('clientes')}>Clientes</Pestana>
        <Pestana activa={seccion === 'proveedores'} onClick={() => setSeccion('proveedores')}>Proveedores</Pestana>
      </div>

      {/* Contenido */}
      <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
        {seccion === 'inicio' && <Inicio usuario={usuario} irAClientes={() => setSeccion('clientes')} irAProveedores={() => setSeccion('proveedores')} irAFacturas={() => setSeccion('facturas')} irAGastos={() => setSeccion('gastos')} irAPresupuestos={() => setSeccion('presupuestos')} />}
        {seccion === 'facturas' && <Facturas />}
        {seccion === 'presupuestos' && <Presupuestos />}
        {seccion === 'gastos' && <Gastos />}
        {seccion === 'clientes' && <Clientes />}
        {seccion === 'proveedores' && <Proveedores />}
      </div>
    </div>
  )
}

function Pestana({ activa, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer',
      fontSize: 14, fontWeight: 700,
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
