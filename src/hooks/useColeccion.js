import { useState, useEffect, useCallback } from 'react'

// Hook genérico para gestionar una colección de datos desde Supabase.
// Recibe un "api" con métodos list/create/update/remove (de api.js).
//
// Uso:
//   const facturas = useColeccion(facturasApi)
//   facturas.items        -> array de datos
//   facturas.cargando     -> boolean
//   facturas.crear(reg)   -> añade
//   facturas.actualizar(id, cambios)
//   facturas.eliminar(id)
//   facturas.recargar()
export function useColeccion(api, autoLoad = true) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(autoLoad)
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    try {
      setCargando(true)
      setError(null)
      const data = await api.list()
      setItems(data)
    } catch (e) {
      console.error('Error cargando datos:', e)
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [api])

  useEffect(() => {
    if (autoLoad) recargar()
  }, [autoLoad, recargar])

  async function crear(registro) {
    const nuevo = await api.create(registro)
    setItems(prev => [...prev, nuevo])
    return nuevo
  }

  async function actualizar(id, cambios) {
    const actualizado = await api.update(id, cambios)
    setItems(prev => prev.map(x => x.id === id ? actualizado : x))
    return actualizado
  }

  async function eliminar(id) {
    await api.remove(id)
    setItems(prev => prev.filter(x => x.id !== id))
  }

  return { items, cargando, error, crear, actualizar, eliminar, recargar, setItems }
}
