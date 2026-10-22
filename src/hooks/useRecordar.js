import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────
// Recordar dónde estabas
// En el móvil, cuando sales a otra app (WhatsApp, el visor de PDF…)
// Android puede cerrar MAHER para ahorrar memoria. Al volver, la app
// arranca de cero. Con esto guardamos la pestaña y los formularios
// abiertos para dejarte justo donde estabas.
// ─────────────────────────────────────────────────────────

const PREFIJO = 'maher_recordar_'

// Lee lo guardado si no es demasiado antiguo (por defecto, 2 horas)
export function leerRecordado(clave, maxMinutos = 120) {
  try {
    const r = JSON.parse(localStorage.getItem(PREFIJO + clave))
    if (r && Date.now() - r.t < maxMinutos * 60000) return r.v
  } catch (e) {}
  return null
}

export function olvidar(clave) {
  try { localStorage.removeItem(PREFIJO + clave) } catch (e) {}
}

// Guarda `valor` cada vez que cambia (null = borrar).
// Con `olvidarAlSalir`, al cambiar de pestaña dentro de la app se borra:
// solo queremos recuperarlo cuando es Android quien cierra la app.
export function useRecordar(clave, valor, { olvidarAlSalir = false } = {}) {
  useEffect(() => {
    try {
      if (valor == null) localStorage.removeItem(PREFIJO + clave)
      else localStorage.setItem(PREFIJO + clave, JSON.stringify({ t: Date.now(), v: valor }))
    } catch (e) {}
  }, [clave, valor])

  useEffect(() => {
    if (!olvidarAlSalir) return
    return () => olvidar(clave)
  }, [clave, olvidarAlSalir])
}
