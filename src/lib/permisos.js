// ─────────────────────────────────────────────────────────
// Qué ve cada rol en la app
//   admin     → Administrador: todo
//   contable  → Contable: todo menos Ajustes
//   comercial → Empleado: facturas, presupuestos, gastos y clientes,
//               sin informes ni cifras del inicio
//   lectura   → Solo consulta: lo ve todo (menos Ajustes) pero no crea ni cambia nada
//
// Esto organiza lo que aparece en pantalla. Lo que cada uno puede
// guardar o borrar lo controla además la base de datos (RLS).
// ─────────────────────────────────────────────────────────

export const SECCIONES = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'presupuestos', label: 'Presupuestos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'informes', label: 'Informes' },
  { id: 'ajustes', label: 'Ajustes' },
]

const TODAS = SECCIONES.map(s => s.id)

const PERMISOS = {
  admin: { secciones: TODAS, verCifras: true, puedeCrear: true },
  contable: { secciones: TODAS.filter(s => s !== 'ajustes'), verCifras: true, puedeCrear: true },
  comercial: { secciones: ['inicio', 'facturas', 'presupuestos', 'gastos', 'clientes'], verCifras: false, puedeCrear: true },
  lectura: { secciones: TODAS.filter(s => s !== 'ajustes'), verCifras: true, puedeCrear: false },
}

export const NOMBRE_ROL = { admin: 'Administrador', contable: 'Contable', comercial: 'Empleado', lectura: 'Solo consulta' }

export function permisosDe(usuario) {
  return PERMISOS[usuario?.rol] || PERMISOS.lectura
}
