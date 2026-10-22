-- ─────────────────────────────────────────────────────────
-- Permisos de usuarios (22/10/2026)
--
-- 1) Un usuario desactivado deja de tener acceso a cualquier dato.
--    Hasta ahora el interruptor "Usuario activo" solo era visual.
-- 2) Los empleados (rol 'comercial') pueden meter y corregir gastos.
--    Borrar sigue reservado a administrador y contable.
-- ─────────────────────────────────────────────────────────

-- 1) Las dos funciones en las que se apoyan todas las reglas de acceso
--    ahora ignoran a los usuarios desactivados.
create or replace function public.mi_empresa_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from usuarios where id = auth.uid() and activo is not false limit 1;
$$;

create or replace function public.mi_rol()
returns text
language sql stable security definer
set search_path = public
as $$
  select rol from usuarios where id = auth.uid() and activo is not false limit 1;
$$;

-- 2) Gastos: los empleados también pueden crearlos y editarlos
drop policy if exists "crear gastos" on public.gastos;
create policy "crear gastos" on public.gastos
  for insert
  with check (empresa_id = mi_empresa_id() and mi_rol() = any (array['admin', 'contable', 'comercial']));

drop policy if exists "editar gastos" on public.gastos;
create policy "editar gastos" on public.gastos
  for update
  using (empresa_id = mi_empresa_id() and mi_rol() = any (array['admin', 'contable', 'comercial']));
