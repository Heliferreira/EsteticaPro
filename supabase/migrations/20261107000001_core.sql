-- Vistoria 3D: núcleo do SaaS (multi-empresa).
-- Rode este arquivo no SQL Editor do Supabase (ou com `supabase db push`).
-- Regra geral: toda tabela de negócio tem company_id e RLS que só deixa
-- o usuário ver/alterar dados das empresas onde ele é membro.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tipos
create type public.member_role as enum ('owner', 'manager', 'operator');
create type public.body_type   as enum ('sedan', 'hatch', 'wagon', 'suv', 'pickup', 'coupe');
create type public.os_status   as enum ('open', 'in_progress', 'done', 'delivered', 'cancelled');

-- ---------------------------------------------------------------- empresas e usuários
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  document   text,
  phone      text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.member_role not null default 'operator',
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- ---------------------------------------------------------------- funções de apoio
-- security definer evita recursão de RLS ao consultar memberships dentro das policies.
create function public.my_company_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select company_id from public.memberships where user_id = auth.uid()
$$;

create function public.has_company_role(cid uuid, roles public.member_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where company_id = cid and user_id = auth.uid() and role = any (roles)
  )
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- cria o perfil quando um usuário se cadastra
create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- cadastros
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 160),
  phone      text,
  email      text,
  document   text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index customers_company_idx on public.customers (company_id, name);

create table public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null,
  plate       text not null check (plate ~ '^[A-Z0-9]{7}$'),
  brand       text,
  model       text not null check (char_length(model) between 1 and 80),
  year        int check (year between 1950 and 2100),
  color       text,
  color_hex   text not null default '#b3121c' check (color_hex ~ '^#[0-9a-fA-F]{6}$'),
  body_type   public.body_type not null default 'sedan',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, plate),
  foreign key (customer_id, company_id) references public.customers (id, company_id)
);
create index vehicles_customer_idx on public.vehicles (customer_id);

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 120),
  default_price numeric(12, 2) not null default 0 check (default_price >= 0),
  est_minutes   int check (est_minutes is null or est_minutes >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, company_id)
);
create index services_company_idx on public.services (company_id, name);

-- funcionários: quem executa o serviço (não precisa ter login)
create table public.employees (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 120),
  role_title text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index employees_company_idx on public.employees (company_id, name);

-- ---------------------------------------------------------------- ordens de serviço
create table public.company_counters (
  company_id uuid primary key references public.companies (id) on delete cascade,
  os_seq     int not null default 0
);

create table public.work_orders (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  number      int  not null,
  customer_id uuid not null,
  vehicle_id  uuid not null,
  employee_id uuid,
  status      public.os_status not null default 'open',
  entry_at    timestamptz not null default now(),
  notes       text,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, number),
  foreign key (customer_id, company_id) references public.customers (id, company_id),
  foreign key (vehicle_id,  company_id) references public.vehicles  (id, company_id),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index work_orders_company_idx on public.work_orders (company_id, entry_at desc);

-- vistoria 3D: uma linha por peça marcada
create table public.work_order_marks (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  work_order_id uuid not null,
  part_id       text not null check (char_length(part_id) between 1 and 40),
  status        text not null default 'ok'
                check (status in ('ok', 'risco', 'riscoP', 'amassado', 'mancha', 'trinca')),
  service_id    uuid,
  price         numeric(12, 2) not null default 0 check (price >= 0),
  note          text check (note is null or char_length(note) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (work_order_id, part_id),
  foreign key (work_order_id, company_id) references public.work_orders (id, company_id) on delete cascade,
  foreign key (service_id, company_id)    references public.services (id, company_id)
);

-- serviços gerais da OS, sem peça específica (ex.: lavagem completa)
create table public.work_order_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  work_order_id uuid not null,
  service_id    uuid,
  description   text not null check (char_length(description) between 1 and 200),
  price         numeric(12, 2) not null default 0 check (price >= 0),
  created_at    timestamptz not null default now(),
  foreign key (work_order_id, company_id) references public.work_orders (id, company_id) on delete cascade,
  foreign key (service_id, company_id)    references public.services (id, company_id)
);
create index work_order_items_os_idx on public.work_order_items (work_order_id);

create trigger customers_touch  before update on public.customers  for each row execute function public.touch_updated_at();
create trigger vehicles_touch   before update on public.vehicles   for each row execute function public.touch_updated_at();
create trigger services_touch   before update on public.services   for each row execute function public.touch_updated_at();
create trigger employees_touch  before update on public.employees  for each row execute function public.touch_updated_at();
create trigger work_orders_touch before update on public.work_orders for each row execute function public.touch_updated_at();
create trigger marks_touch      before update on public.work_order_marks for each row execute function public.touch_updated_at();

-- lista de OS já com nomes e total (security_invoker: respeita a RLS de quem consulta)
create view public.os_list with (security_invoker = true) as
select
  wo.id, wo.company_id, wo.number, wo.status, wo.entry_at,
  wo.customer_id, wo.vehicle_id, wo.employee_id,
  c.name  as customer_name,
  v.plate, v.brand, v.model,
  e.name  as employee_name,
  coalesce(m.total, 0) + coalesce(i.total, 0) as total
from public.work_orders wo
join public.customers c on c.id = wo.customer_id
join public.vehicles  v on v.id = wo.vehicle_id
left join public.employees e on e.id = wo.employee_id
left join (select work_order_id, sum(price) as total from public.work_order_marks group by work_order_id) m on m.work_order_id = wo.id
left join (select work_order_id, sum(price) as total from public.work_order_items group by work_order_id) i on i.work_order_id = wo.id;

-- ---------------------------------------------------------------- RPCs
-- Cria a empresa, torna o usuário dono e já cria uns serviços de exemplo.
create function public.create_company(p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para criar a empresa.';
  end if;
  insert into public.companies (name) values (trim(p_name)) returning id into cid;
  insert into public.memberships (company_id, user_id, role) values (cid, auth.uid(), 'owner');
  insert into public.company_counters (company_id, os_seq) values (cid, 0);
  insert into public.services (company_id, name, default_price, est_minutes) values
    (cid, 'Lavagem detalhada',     80, 90),
    (cid, 'Polimento comercial',  150, 120),
    (cid, 'Polimento técnico',    280, 240),
    (cid, 'Remoção de riscos',    120, 90),
    (cid, 'Vitrificação',         450, 300),
    (cid, 'Martelinho de ouro',   180, 120),
    (cid, 'Polimento de faróis',   90, 60),
    (cid, 'Aplicação de película',220, 180),
    (cid, 'Higienização',         150, 120);
  return cid;
end
$$;
revoke all on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated;

-- Abre uma OS com número sequencial por empresa (security invoker: a RLS vale).
create function public.create_work_order(
  p_customer uuid, p_vehicle uuid, p_employee uuid, p_notes text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  cid uuid;
  vcust uuid;
  n int;
  new_id uuid;
begin
  select company_id, customer_id into cid, vcust from public.vehicles where id = p_vehicle;
  if cid is null then
    raise exception 'Veículo não encontrado.';
  end if;
  if vcust <> p_customer then
    raise exception 'O veículo não pertence a este cliente.';
  end if;

  insert into public.company_counters (company_id, os_seq) values (cid, 1)
  on conflict (company_id) do update set os_seq = public.company_counters.os_seq + 1
  returning os_seq into n;

  insert into public.work_orders (company_id, number, customer_id, vehicle_id, employee_id, notes, created_by)
  values (cid, n, p_customer, p_vehicle, p_employee, nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into new_id;

  return new_id;
end
$$;
grant execute on function public.create_work_order(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.companies        enable row level security;
alter table public.profiles         enable row level security;
alter table public.memberships      enable row level security;
alter table public.customers        enable row level security;
alter table public.vehicles         enable row level security;
alter table public.services         enable row level security;
alter table public.employees        enable row level security;
alter table public.company_counters enable row level security;
alter table public.work_orders      enable row level security;
alter table public.work_order_marks enable row level security;
alter table public.work_order_items enable row level security;

create policy companies_select on public.companies for select
  using (id in (select public.my_company_ids()));
create policy companies_update on public.companies for update
  using (public.has_company_role(id, array['owner','manager']::public.member_role[]));

create policy profiles_select on public.profiles for select
  using (id = auth.uid()
         or id in (select user_id from public.memberships where company_id in (select public.my_company_ids())));
create policy profiles_update on public.profiles for update
  using (id = auth.uid());

create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or company_id in (select public.my_company_ids()));
create policy memberships_write on public.memberships for all
  using (public.has_company_role(company_id, array['owner']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.member_role[]));

-- Cadastros do dia a dia: qualquer membro lê, cria e edita; só dono/gerente exclui.
create policy customers_select on public.customers for select using (company_id in (select public.my_company_ids()));
create policy customers_insert on public.customers for insert with check (company_id in (select public.my_company_ids()));
create policy customers_update on public.customers for update using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));
create policy customers_delete on public.customers for delete
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy vehicles_select on public.vehicles for select using (company_id in (select public.my_company_ids()));
create policy vehicles_insert on public.vehicles for insert with check (company_id in (select public.my_company_ids()));
create policy vehicles_update on public.vehicles for update using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));
create policy vehicles_delete on public.vehicles for delete
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

-- Serviços e funcionários: qualquer membro lê; só dono/gerente altera.
create policy services_select on public.services for select using (company_id in (select public.my_company_ids()));
create policy services_write on public.services for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy employees_select on public.employees for select using (company_id in (select public.my_company_ids()));
create policy employees_write on public.employees for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy counters_all on public.company_counters for all
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

create policy work_orders_select on public.work_orders for select using (company_id in (select public.my_company_ids()));
create policy work_orders_insert on public.work_orders for insert with check (company_id in (select public.my_company_ids()));
create policy work_orders_update on public.work_orders for update using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));
create policy work_orders_delete on public.work_orders for delete
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy marks_all on public.work_order_marks for all
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));
create policy items_all on public.work_order_items for all
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

grant select on public.os_list to authenticated;
