-- =====================================================================
-- Meu Atendimento SUS — esquema do banco (Supabase / PostgreSQL)
-- Inclui: tabelas, regras anti-duplicidade e anti-conflito, RLS por
-- perfil (cidadão, gestor de unidade, administrador) e funções RPC.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------- Perfis ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 3 and 120),
  birth_date date,
  -- CPF e CNS são opcionais (minimização de dados - LGPD).
  cpf text check (cpf is null or cpf ~ '^\d{11}$'),
  cns text check (cns is null or cns ~ '^\d{15}$'),
  phone text,
  address text,
  neighborhood text,
  role text not null default 'cidadao' check (role in ('cidadao', 'gestor_unidade', 'admin')),
  prefs jsonb not null default '{"lembretes":true,"alteracoes":true,"avisosUnidade":true,"preparoExame":true,"navegador":false}',
  created_at timestamptz not null default now()
);

-- ---------- Catálogo ----------
create table public.specialties (
  id text primary key,
  name text not null,
  requires_referral boolean not null default false
);

create table public.exams (
  id text primary key,
  name text not null,
  category text not null check (category in ('laboratorial', 'imagem', 'outros')),
  requires_referral boolean not null default false,
  -- Preparo: somente texto oficial fornecido pela unidade/rede.
  preparation text,
  preparation_source text
);

create table public.units (
  id text primary key,
  name text not null,
  type text not null check (type in ('UBS', 'UPA', 'HOSPITAL', 'CLINICA', 'LABORATORIO')),
  address text not null,
  neighborhood text not null,
  city text not null,
  cep text not null,
  lat double precision not null,
  lng double precision not null,
  phone text,
  hours jsonb not null,
  services text[] not null default '{}',
  specialty_ids text[] not null default '{}',
  exam_ids text[] not null default '{}',
  accessibility text[] not null default '{}',
  is_demo boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.unit_managers (
  user_id uuid references public.profiles (id) on delete cascade,
  unit_id text references public.units (id) on delete cascade,
  primary key (user_id, unit_id)
);

-- ---------- Filas ----------
create table public.queue_status (
  unit_id text primary key references public.units (id) on delete cascade,
  level text not null check (level in ('baixo', 'moderado', 'alto', 'indisponivel')),
  people_waiting int check (people_waiting is null or people_waiting >= 0),
  wait_minutes int check (wait_minutes is null or wait_minutes >= 0),
  service_type text not null default 'Atendimento',
  unit_situation text not null default 'aberta' check (unit_situation in ('aberta', 'fechada', 'atendimento_restrito')),
  source text not null check (source in ('demonstracao', 'unidade', 'integracao', 'indisponivel')),
  updated_at timestamptz,
  updated_by text
);

-- Histórico: toda atualização de fila registra data e origem.
create table public.queue_updates (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units (id) on delete cascade,
  level text not null,
  people_waiting int,
  wait_minutes int,
  source text not null,
  updated_by text not null,
  updated_by_user uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------- Agenda ----------
create table public.slots (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units (id) on delete cascade,
  kind text not null check (kind in ('consulta', 'exame')),
  ref_id text not null,
  starts_at timestamptz not null,
  duration_min int not null default 30 check (duration_min between 5 and 240),
  professional text,
  booked boolean not null default false,
  unique (unit_id, kind, ref_id, starts_at)
);
create index on public.slots (kind, ref_id, starts_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id text not null references public.units (id),
  kind text not null check (kind in ('consulta', 'exame')),
  ref_id text not null,
  slot_id uuid references public.slots (id),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null check (status in ('solicitada', 'aguardando_autorizacao', 'confirmada', 'cancelada', 'realizada')),
  note text,
  change_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um pedido confirmado precisa de horário.
  check (status <> 'confirmada' or (slot_id is not null and starts_at is not null))
);

-- Um horário só pode ter um agendamento ativo.
create unique index appointments_one_active_per_slot
  on public.appointments (slot_id)
  where slot_id is not null and status in ('solicitada', 'aguardando_autorizacao', 'confirmada');

-- No máximo um pedido ativo por usuário para a mesma especialidade/exame.
create unique index appointments_no_duplicate_request
  on public.appointments (user_id, kind, ref_id)
  where status in ('solicitada', 'aguardando_autorizacao', 'confirmada');

-- Sem sobreposição de horários do mesmo usuário.
alter table public.appointments
  add constraint appointments_no_time_conflict
  exclude using gist (
    user_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (starts_at is not null and status in ('solicitada', 'aguardando_autorizacao', 'confirmada'));

-- ---------- Notificações e avisos ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  -- Texto exibido em tela bloqueada / push: nunca contém dado médico.
  lock_screen_text text not null default 'Você tem uma nova mensagem no Meu Atendimento SUS.',
  category text not null check (category in ('lembrete', 'alteracao', 'unidade', 'preparo')),
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notices (
  id text primary key,
  title text not null,
  body text not null,
  tone text not null default 'info' check (tone in ('info', 'alerta')),
  active boolean not null default true
);

-- =====================================================================
-- Funções auxiliares de permissão
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.manages_unit(p_unit text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from profiles p join unit_managers m on m.user_id = p.id
    where p.id = auth.uid() and p.role = 'gestor_unidade' and m.unit_id = p_unit
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'gestor_unidade'));
$$;

-- Cria o perfil automaticamente no cadastro.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, birth_date)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que o próprio usuário altere seu papel.
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Somente administradores alteram perfis de acesso';
  end if;
  return new;
end $$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_role();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.specialties enable row level security;
alter table public.exams enable row level security;
alter table public.units enable row level security;
alter table public.unit_managers enable row level security;
alter table public.queue_status enable row level security;
alter table public.queue_updates enable row level security;
alter table public.slots enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;
alter table public.notices enable row level security;

-- Perfis
create policy "perfil: dono lê" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "perfil: dono edita" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Catálogo público (leitura)
create policy "catálogo: leitura" on public.specialties for select using (true);
create policy "exames: leitura" on public.exams for select using (true);
create policy "unidades: leitura" on public.units for select using (true);
create policy "filas: leitura" on public.queue_status for select using (true);
create policy "avisos: leitura" on public.notices for select using (active);
create policy "vagas: leitura" on public.slots for select using (true);

-- Catálogo: escrita restrita
create policy "unidades: admin cria" on public.units for insert with check (public.is_admin());
create policy "unidades: gestor edita" on public.units for update using (public.manages_unit(id));
create policy "unidades: admin remove" on public.units for delete using (public.is_admin());
create policy "gestores: admin" on public.unit_managers for all using (public.is_admin()) with check (public.is_admin());
create policy "gestores: leitura própria" on public.unit_managers for select using (user_id = auth.uid() or public.is_admin());
create policy "vagas: gestor cria" on public.slots for insert with check (public.manages_unit(unit_id));
create policy "vagas: gestor remove" on public.slots for delete using (public.manages_unit(unit_id) and not booked);
create policy "avisos: admin" on public.notices for all using (public.is_admin()) with check (public.is_admin());

-- Histórico de filas: só equipe lê; escrita apenas pela função update_queue.
create policy "histórico fila: equipe" on public.queue_updates for select using (public.manages_unit(unit_id));

-- Agendamentos: cidadão vê os seus; gestor vê os da unidade. Escrita só via RPC.
create policy "agendamentos: leitura" on public.appointments for select
  using (user_id = auth.uid() or public.manages_unit(unit_id));

-- Notificações
create policy "notificações: dono" on public.notifications for select using (user_id = auth.uid());
create policy "notificações: marcar lida" on public.notifications for update using (user_id = auth.uid());

-- =====================================================================
-- RPC: regras de negócio no servidor
-- =====================================================================
create or replace function public.new_protocol() returns text
language sql volatile as $$
  select 'MAS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;

create or replace function public.book_appointment(
  p_kind text,
  p_ref_id text,
  p_unit_id text,
  p_slot_id uuid,
  p_note text default null,
  p_replaces_id uuid default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_unit units;
  v_requires boolean;
  v_slot slots;
  v_status text;
  v_appt appointments;
begin
  if v_user is null then raise exception 'Faça login para agendar' using errcode = '28000'; end if;

  select * into v_unit from units where id = p_unit_id;
  if not found then raise exception 'Unidade não encontrada'; end if;

  if p_kind = 'consulta' then
    if not (p_ref_id = any (v_unit.specialty_ids)) then raise exception 'Esta unidade não oferece esta especialidade'; end if;
    select requires_referral into v_requires from specialties where id = p_ref_id;
  else
    if not (p_ref_id = any (v_unit.exam_ids)) then raise exception 'Esta unidade não oferece este exame'; end if;
    select requires_referral into v_requires from exams where id = p_ref_id;
  end if;

  -- Remarcação: cancela o anterior na mesma transação.
  if p_replaces_id is not null then
    update appointments set status = 'cancelada', note = 'Remarcado pelo usuário', updated_at = now()
     where id = p_replaces_id and user_id = v_user and status in ('solicitada', 'aguardando_autorizacao', 'confirmada');
    update slots set booked = false
     where id = (select slot_id from appointments where id = p_replaces_id);
  end if;

  if v_requires then
    -- Depende de regulação: nunca nasce confirmado.
    v_status := 'aguardando_autorizacao';
  else
    if p_slot_id is null then raise exception 'Escolha um horário'; end if;
    select * into v_slot from slots where id = p_slot_id for update;
    if not found or v_slot.unit_id <> p_unit_id or v_slot.ref_id <> p_ref_id then raise exception 'Horário inválido'; end if;
    if v_slot.starts_at <= now() then raise exception 'Este horário já passou'; end if;
    if v_slot.booked then raise exception 'Este horário acabou de ser preenchido. Escolha outro.'; end if;
    update slots set booked = true where id = v_slot.id;
    v_status := 'confirmada';
  end if;

  insert into appointments (protocol, user_id, unit_id, kind, ref_id, slot_id, starts_at, ends_at, status, note)
  values (new_protocol(), v_user, p_unit_id, p_kind, p_ref_id,
          case when v_requires then null else v_slot.id end,
          case when v_requires then null else v_slot.starts_at end,
          case when v_requires then null else v_slot.starts_at + make_interval(mins => v_slot.duration_min) end,
          v_status, p_note)
  returning * into v_appt;

  insert into notifications (user_id, title, body, category, link)
  values (v_user,
          case when v_status = 'confirmada' then 'Agendamento confirmado' else 'Pedido registrado' end,
          'Protocolo ' || v_appt.protocol || '.', 'alteracao', '/agendamentos#' || v_appt.id);

  return v_appt;
exception
  when unique_violation then
    raise exception 'Você já tem um pedido ativo para este atendimento, ou o horário foi ocupado.';
  when exclusion_violation then
    raise exception 'Você já tem outro compromisso neste horário.';
end $$;

create or replace function public.cancel_appointment(p_id uuid) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare v appointments;
begin
  select * into v from appointments where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if v.status not in ('solicitada', 'aguardando_autorizacao', 'confirmada') then raise exception 'Não pode mais ser cancelado'; end if;
  if v.starts_at is not null and v.starts_at < now() then raise exception 'O atendimento já passou'; end if;
  update appointments set status = 'cancelada', updated_at = now() where id = p_id returning * into v;
  if v.slot_id is not null then update slots set booked = false where id = v.slot_id; end if;
  return v;
end $$;

create or replace function public.request_appointment_change(p_id uuid, p_note text) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare v appointments;
begin
  update appointments set change_requested = true, note = p_note, updated_at = now()
   where id = p_id and user_id = auth.uid() and status in ('solicitada', 'aguardando_autorizacao', 'confirmada')
  returning * into v;
  if not found then raise exception 'Não é possível pedir alteração'; end if;
  return v;
end $$;

create or replace function public.staff_set_appointment_status(p_id uuid, p_status text, p_slot_id uuid default null)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare v appointments; s slots;
begin
  select * into v from appointments where id = p_id for update;
  if not found or not public.manages_unit(v.unit_id) then raise exception 'Sem permissão'; end if;
  if p_status = 'confirmada' and v.slot_id is null then
    select * into s from slots where id = p_slot_id and unit_id = v.unit_id and not booked for update;
    if not found then raise exception 'Escolha um horário disponível para confirmar'; end if;
    update slots set booked = true where id = s.id;
    update appointments set slot_id = s.id, starts_at = s.starts_at,
      ends_at = s.starts_at + make_interval(mins => s.duration_min) where id = p_id;
  end if;
  if p_status = 'cancelada' and v.slot_id is not null then
    update slots set booked = false where id = v.slot_id;
  end if;
  update appointments set status = p_status, change_requested = false, updated_at = now() where id = p_id returning * into v;
  insert into notifications (user_id, title, body, category, link)
  values (v.user_id, 'Seu agendamento foi atualizado', 'Protocolo ' || v.protocol || '.', 'alteracao', '/agendamentos#' || v.id);
  return v;
end $$;

create or replace function public.update_queue(
  p_unit_id text, p_level text, p_people int, p_wait int, p_service_type text, p_situation text
) returns public.queue_status
language plpgsql security definer set search_path = public as $$
declare v queue_status; v_name text;
begin
  if not public.manages_unit(p_unit_id) then raise exception 'Sem permissão para esta unidade'; end if;
  select full_name into v_name from profiles where id = auth.uid();
  insert into queue_status as q (unit_id, level, people_waiting, wait_minutes, service_type, unit_situation, source, updated_at, updated_by)
  values (p_unit_id, p_level, p_people, p_wait, p_service_type, p_situation,
          case when p_level = 'indisponivel' then 'indisponivel' else 'unidade' end,
          case when p_level = 'indisponivel' then null else now() end, v_name)
  on conflict (unit_id) do update set
    level = excluded.level, people_waiting = excluded.people_waiting, wait_minutes = excluded.wait_minutes,
    service_type = excluded.service_type, unit_situation = excluded.unit_situation, source = excluded.source,
    updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into v;
  insert into queue_updates (unit_id, level, people_waiting, wait_minutes, source, updated_by, updated_by_user)
  values (p_unit_id, p_level, p_people, p_wait, v.source, v_name, auth.uid());
  return v;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text, p_units text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'Você não pode remover o próprio acesso'; end if;
  update profiles set role = p_role where id = p_user;
  delete from unit_managers where user_id = p_user;
  if p_role = 'gestor_unidade' then
    insert into unit_managers (user_id, unit_id) select p_user, unnest(p_units);
  end if;
end $$;

grant execute on function public.book_appointment, public.cancel_appointment, public.request_appointment_change,
  public.staff_set_appointment_status, public.update_queue, public.admin_set_role to authenticated;
