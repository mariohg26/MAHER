import { useState, useEffect } from 'react'
import { auth } from '../lib/api'

// Hook de autenticación: gestiona sesión, usuario actual, login y logout
export function useAuth() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Comprobar sesión al cargar
    cargarUsuario()

    // Escuchar cambios de sesión (login/logout en otra pestaña, etc.)
    const { data: listener } = auth.onAuthChange((session) => {
      if (session) cargarUsuario()
      else setUsuario(null)
    })

    return () => listener?.subscription?.unsubscribe()
  }, [])

  async function cargarUsuario() {
    try {
      setCargando(true)
      const session = await auth.getSession()
      if (session) {
        const u = await auth.getUsuarioActual()
        setUsuario(u)
      } else {
        setUsuario(null)
      }
    } catch (e) {
      console.error('Error cargando usuario:', e)
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }

  async function login(email, password) {
    setError(null)
    try {
      await auth.login(email, password)
      const u = await auth.getUsuarioActual()
      setUsuario(u)
      return true
    } catch (e) {
      let msg = e.message
      if (msg === 'Invalid login credentials') msg = 'Email o contraseña incorrectos'
      else if (msg === 'Email not confirmed') msg = 'Este usuario aún no está activado. Pide al administrador que le ponga una contraseña nueva desde Ajustes → Usuarios.'
      else if (e.code === 'PGRST116') {
        // Ha entrado en el sistema pero no tiene ficha visible: está desactivado
        msg = 'Tu usuario está desactivado. Habla con el administrador.'
        try { await auth.logout() } catch (err) {}
      }
      setError(msg)
      return false
    }
  }

  async function logout() {
    await auth.logout()
    setUsuario(null)
  }

  return { usuario, cargando, error, login, logout, recargar: cargarUsuario }
}
