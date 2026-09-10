-- =====================================================================
-- SISTEMA DE CONCILIACIÓN DE PAGOS — esquema completo
-- =====================================================================
-- CÓMO USARLO:
-- 1. Entra a tu proyecto en supabase.com → "SQL Editor" → "New query"
-- 2. Pega TODO este archivo y dale "Run"
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFILES — cada usuario (master o chica) tiene un perfil con su
--    nombre y su rol. Se crea automático cuando agregas un usuario
--    nuevo en Authentication (ver más abajo cómo).
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('master', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Cualquier usuario logueado puede ver todos los perfiles (para saber
-- "quién registró este pago"), pero no puede editarlos.
drop policy if exists "Usuarios ven todos los perfiles" on profiles;
create policy "Usuarios ven todos los perfiles"
  on profiles for select
  to authenticated
  using (true);

-- Solo el propio usuario (al crearse la cuenta) puede insertar su perfil;
-- en la práctica lo hace el trigger de abajo, no a mano.
drop policy if exists "Solo el trigger inserta perfiles" on profiles;
create policy "Solo el trigger inserta perfiles"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Solo un master puede cambiar roles o desactivar usuarios.
drop policy if exists "Solo master edita perfiles" on profiles;
create policy "Solo master edita perfiles"
  on profiles for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'master'));

-- Cuando se crea un usuario nuevo en Authentication, esto le crea el
-- perfil automático con rol "staff" por defecto (el master se asciende
-- manualmente después, ver README).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- 2. CUENTAS DE PAGO — los datos donde reciben el dinero (Pago Móvil,
--    Binance, Zelle, etc). Solo el master las edita; todos las ven.
-- ---------------------------------------------------------------------
create table if not exists payment_accounts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('pago_movil', 'binance', 'zelle', 'otro')),
  label text not null,           -- nombre para identificarla, ej: "Pago Móvil Edgar"
  phone text default '',
  cedula text default '',
  bank text default '',
  email text default '',
  holder_name text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table payment_accounts enable row level security;

drop policy if exists "Todos ven las cuentas de pago" on payment_accounts;
create policy "Todos ven las cuentas de pago"
  on payment_accounts for select
  to authenticated
  using (true);

drop policy if exists "Solo master administra cuentas (insert)" on payment_accounts;
create policy "Solo master administra cuentas (insert)"
  on payment_accounts for insert
  to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'master'));

drop policy if exists "Solo master administra cuentas (update)" on payment_accounts;
create policy "Solo master administra cuentas (update)"
  on payment_accounts for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'master'));

drop policy if exists "Solo master administra cuentas (delete)" on payment_accounts;
create policy "Solo master administra cuentas (delete)"
  on payment_accounts for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'master'));

-- ---------------------------------------------------------------------
-- 3. CONCILIACIONES — cada pago que una chica registra. La referencia
--    es ÚNICA a nivel de base de datos: es IMPOSIBLE que se repita,
--    aunque dos personas intenten meterla al mismo tiempo.
-- ---------------------------------------------------------------------
create table if not exists reconciliations (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null,
  reference text not null unique,   -- los 6 dígitos finales — ÚNICO
  amount numeric not null check (amount > 0),
  payment_type text not null check (payment_type in ('pago_movil', 'binance', 'zelle', 'otro')),
  customer_name text default '',
  customer_phone text default '',
  note text default '',
  entered_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table reconciliations enable row level security;

-- Todos los usuarios logueados (master + staff) ven todas las conciliaciones.
drop policy if exists "Todos ven las conciliaciones" on reconciliations;
create policy "Todos ven las conciliaciones"
  on reconciliations for select
  to authenticated
  using (true);

-- Todos (master + staff) pueden AGREGAR una conciliación nueva.
drop policy if exists "Todos pueden agregar conciliaciones" on reconciliations;
create policy "Todos pueden agregar conciliaciones"
  on reconciliations for insert
  to authenticated
  with check (auth.uid() = entered_by);

-- Solo el master puede editar o borrar (las chicas NO pueden tocar lo
-- ya registrado, ni lo propio ni lo ajeno).
drop policy if exists "Solo master edita conciliaciones" on reconciliations;
create policy "Solo master edita conciliaciones"
  on reconciliations for update
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'master'));

drop policy if exists "Solo master borra conciliaciones" on reconciliations;
create policy "Solo master borra conciliaciones"
  on reconciliations for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'master'));

create index if not exists idx_reconciliations_reference on reconciliations (reference);
create index if not exists idx_reconciliations_date on reconciliations (payment_date desc);
