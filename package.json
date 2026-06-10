-- ═══════════════════════════════════════════════════════════════════
-- SCHEMA SQL PARA MAHER APP - QUESOS MAHER SL
-- Ejecutar en Supabase: SQL Editor → New query → pegar todo → Run
-- ═══════════════════════════════════════════════════════════════════

-- 1) TABLA EMPRESA (configuración global, una sola fila por empresa)
CREATE TABLE empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL DEFAULT 'QUESOS MAHER SL',
  nif TEXT NOT NULL DEFAULT 'B37267259',
  direccion TEXT,
  cp TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'ES',
  telefono TEXT,
  email TEXT,
  web TEXT,
  iban TEXT,
  swift TEXT,
  -- Configuración de la app (JSON flexible)
  config JSONB DEFAULT '{}'::jsonb,
  cuentas_bancarias JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) USUARIOS (vincula con auth.users de Supabase)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  rol TEXT NOT NULL DEFAULT 'lectura' CHECK (rol IN ('admin','contable','comercial','lectura')),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- 3) CLIENTES
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE NOT NULL,
  tipo_persona TEXT DEFAULT 'sociedad',
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  nif TEXT,
  direccion TEXT,
  cp TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'ES',
  email TEXT,
  telefono TEXT,
  iban TEXT,
  retencion_irpf NUMERIC(5,4) DEFAULT 0,
  forma_pago TEXT,
  plazo_pago INTEGER DEFAULT 30,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) PROVEEDORES
CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE NOT NULL,
  tipo_persona TEXT DEFAULT 'sociedad',
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  nif TEXT,
  direccion TEXT,
  cp TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'ES',
  email TEXT,
  telefono TEXT,
  iban TEXT,
  retencion_irpf NUMERIC(5,4) DEFAULT 0,
  recargo_equiv BOOLEAN DEFAULT FALSE,
  forma_pago TEXT,
  plazo_pago INTEGER DEFAULT 30,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) FACTURAS
CREATE TABLE facturas (
  id TEXT PRIMARY KEY,  -- F-2026-001
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  vencimiento DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','cobrada','vencida')),
  retencion_irpf NUMERIC(5,4) DEFAULT 0,
  cobrado_parcial NUMERIC(12,2) DEFAULT 0,
  cuenta_bancaria_id INTEGER,
  factura_rectificada TEXT,  -- si es rectificativa, referencia a la original
  lineas JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{desc,cant,precio,iva}]
  notas TEXT,
  creado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) PRESUPUESTOS
CREATE TABLE presupuestos (
  id TEXT PRIMARY KEY,  -- P-2026-001
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  validez DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptado','rechazado','facturado')),
  retencion_irpf NUMERIC(5,4) DEFAULT 0,
  lineas JSONB NOT NULL DEFAULT '[]'::jsonb,
  factura_id TEXT REFERENCES facturas(id),  -- si se convirtió en factura
  notas TEXT,
  creado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) GASTOS
CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE NOT NULL,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  concepto TEXT NOT NULL,
  fecha DATE NOT NULL,
  categoria TEXT,
  deducible BOOLEAN DEFAULT TRUE,
  retencion_irpf NUMERIC(5,4) DEFAULT 0,
  lineas JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas TEXT,
  creado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) TAREAS
CREATE TABLE tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresa(id) ON DELETE CASCADE NOT NULL,
  asignado_a UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_por UUID REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora TIME,
  prioridad TEXT DEFAULT 'normal' CHECK (prioridad IN ('baja','normal','alta')),
  completada BOOLEAN DEFAULT FALSE,
  relacion_factura TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- ÍNDICES para acelerar consultas frecuentes
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_facturas_empresa ON facturas(empresa_id);
CREATE INDEX idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX idx_facturas_fecha ON facturas(fecha);
CREATE INDEX idx_facturas_estado ON facturas(estado);
CREATE INDEX idx_gastos_empresa ON gastos(empresa_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_proveedores_empresa ON proveedores(empresa_id);
CREATE INDEX idx_tareas_asignado ON tareas(asignado_a);
CREATE INDEX idx_tareas_fecha ON tareas(fecha);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) - Seguridad por usuario
-- Cada usuario solo ve datos de SU empresa
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- Función auxiliar: empresa del usuario actual
CREATE OR REPLACE FUNCTION mi_empresa_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- Función auxiliar: rol del usuario actual
CREATE OR REPLACE FUNCTION mi_rol()
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- POLÍTICAS: empresa
CREATE POLICY "ver mi empresa" ON empresa FOR SELECT USING (id = mi_empresa_id());
CREATE POLICY "editar mi empresa admin" ON empresa FOR UPDATE USING (id = mi_empresa_id() AND mi_rol() = 'admin');

-- POLÍTICAS: usuarios
CREATE POLICY "ver usuarios mi empresa" ON usuarios FOR SELECT USING (empresa_id = mi_empresa_id());
CREATE POLICY "crear usuarios admin" ON usuarios FOR INSERT WITH CHECK (mi_rol() = 'admin' AND empresa_id = mi_empresa_id());
CREATE POLICY "editar usuarios admin" ON usuarios FOR UPDATE USING (mi_rol() = 'admin' AND empresa_id = mi_empresa_id());
CREATE POLICY "borrar usuarios admin" ON usuarios FOR DELETE USING (mi_rol() = 'admin' AND empresa_id = mi_empresa_id());

-- POLÍTICAS: clientes
CREATE POLICY "ver clientes" ON clientes FOR SELECT USING (empresa_id = mi_empresa_id());
CREATE POLICY "crear clientes" ON clientes FOR INSERT WITH CHECK (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable','comercial'));
CREATE POLICY "editar clientes" ON clientes FOR UPDATE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable','comercial'));
CREATE POLICY "borrar clientes" ON clientes FOR DELETE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));

-- POLÍTICAS: proveedores (igual que clientes pero comercial no puede tocar)
CREATE POLICY "ver proveedores" ON proveedores FOR SELECT USING (empresa_id = mi_empresa_id());
CREATE POLICY "crear proveedores" ON proveedores FOR INSERT WITH CHECK (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));
CREATE POLICY "editar proveedores" ON proveedores FOR UPDATE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));
CREATE POLICY "borrar proveedores" ON proveedores FOR DELETE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));

-- POLÍTICAS: facturas
CREATE POLICY "ver facturas" ON facturas FOR SELECT USING (empresa_id = mi_empresa_id());
CREATE POLICY "crear facturas" ON facturas FOR INSERT WITH CHECK (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable','comercial'));
CREATE POLICY "editar facturas" ON facturas FOR UPDATE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable','comercial'));
CREATE POLICY "borrar facturas" ON facturas FOR DELETE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));

-- POLÍTICAS: presupuestos
CREATE POLICY "ver presupuestos" ON presupuestos FOR SELECT USING (empresa_id = mi_empresa_id());
CREATE POLICY "crear presupuestos" ON presupuestos FOR INSERT WITH CHECK (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable','comercial'));
CREATE POLICY "editar presupuestos" ON presupuestos FOR UPDATE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable','comercial'));
CREATE POLICY "borrar presupuestos" ON presupuestos FOR DELETE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));

-- POLÍTICAS: gastos
CREATE POLICY "ver gastos" ON gastos FOR SELECT USING (empresa_id = mi_empresa_id());
CREATE POLICY "crear gastos" ON gastos FOR INSERT WITH CHECK (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));
CREATE POLICY "editar gastos" ON gastos FOR UPDATE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));
CREATE POLICY "borrar gastos" ON gastos FOR DELETE USING (empresa_id = mi_empresa_id() AND mi_rol() IN ('admin','contable'));

-- POLÍTICAS: tareas (admin ve todas, resto solo las suyas)
CREATE POLICY "ver tareas" ON tareas FOR SELECT USING (
  empresa_id = mi_empresa_id() AND (mi_rol() = 'admin' OR asignado_a = auth.uid())
);
CREATE POLICY "crear tareas" ON tareas FOR INSERT WITH CHECK (empresa_id = mi_empresa_id());
CREATE POLICY "editar tareas" ON tareas FOR UPDATE USING (
  empresa_id = mi_empresa_id() AND (mi_rol() = 'admin' OR asignado_a = auth.uid())
);
CREATE POLICY "borrar tareas" ON tareas FOR DELETE USING (
  empresa_id = mi_empresa_id() AND (mi_rol() = 'admin' OR creado_por = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════
-- DATOS INICIALES PARA QUESOS MAHER SL
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO empresa (id, nombre, nif, direccion, cp, ciudad, provincia, pais)
VALUES (
  gen_random_uuid(),
  'QUESOS MAHER SL',
  'B37267259',
  'Cl Cañón de Rio Lobos, 47-49 P.I.El Montalvo II',
  '37008',
  'SALAMANCA',
  'Salamanca',
  'ES'
);

-- IMPORTANTE: Después de ejecutar esto, copia el UUID de empresa creada
-- (se ve en Table Editor → empresa) y guárdalo para vincular tu usuario
