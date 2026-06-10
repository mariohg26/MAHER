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
      setError(e.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : e.message)
      return false
    }
  }

  async function logout() {
    await auth.logout()
    setUsuario(null)
  }

  return { usuario, cargando, error, login, logout, recargar: cargarUsuario }
}
