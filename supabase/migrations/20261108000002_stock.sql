-- ============================================================================
-- Estoque: produtos, movimentações, consumo por serviço e baixa automática na OS
-- ============================================================================

create table public.products (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 120),
  sku        text,
  unit       text not null default 'un' check (unit in ('un', 'ml', 'l', 'g', 'kg')),
  min_stock  numeric(14, 3) not null default 0 check (min_stock >= 0),
  cost       numeric(12, 2) not null default 0 check (cost >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index products_company_idx on public.products (company_id, name);

-- movimentações: quantidade com sinal (entrada +, saída -, ajuste ±)
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  product_id    uuid not null,
  kind          text not null check (kind in ('in', 'out', 'adjust', 'os')),
  qty           numeric(14, 3) not null check (qty <> 0),
  note          text check (note is null or char_length(note) <= 200),
  work_order_id uuid,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  foreign key (product_id, company_id) references public.products (id, company_id) on delete cascade,
  foreign key (work_order_id, company_id) references public.work_orders (id, company_id) on delete set null (work_order_id)
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_os_idx on public.stock_movements (work_order_id) where work_order_id is not null;

-- quanto de cada produto um serviço consome por aplicação
create table public.service_products (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  service_id uuid not null,
  product_id uuid not null,
  qty        numeric(14, 3) not null check (qty > 0),
  unique (service_id, product_id),
  foreign key (service_id, company_id) references public.services (id, company_id) on delete cascade,
  foreign key (product_id, company_id) references public.products (id, company_id) on delete cascade
);

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create view public.product_stock with (security_invoker = true) as
select p.id, p.company_id, p.name, p.sku, p.unit, p.min_stock, p.cost, p.active,
       coalesce(sum(m.qty), 0)::numeric(14, 3) as stock,
       coalesce(sum(m.qty), 0) <= p.min_stock as low
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;
grant select on public.product_stock to authenticated;

-- Baixa automática: consome os produtos dos serviços usados na OS (marcas + itens).
-- Idempotente: se a OS já teve baixa, não faz nada.
create function public.consume_order_stock(p_order uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  cid uuid;
  n int;
begin
  select company_id into cid from public.work_orders where id = p_order;
  if cid is null then
    raise exception 'OS não encontrada.';
  end if;
  if exists (select 1 from public.stock_movements where work_order_id = p_order and kind = 'os') then
    return 0;
  end if;

  with used as (
    select service_id from public.work_order_marks where work_order_id = p_order and service_id is not null
    union all
    select service_id from public.work_order_items where work_order_id = p_order and service_id is not null
  ), need as (
    select sp.product_id, sum(sp.qty) as qty
    from used u join public.service_products sp on sp.service_id = u.service_id
    group by sp.product_id
  )
  insert into public.stock_movements (company_id, product_id, kind, qty, note, work_order_id, created_by)
  select cid, product_id, 'os', -qty, 'Baixa automática da OS', p_order, auth.uid() from need;

  get diagnostics n = row_count;
  return n;
end
$$;
grant execute on function public.consume_order_stock(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.products         enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.service_products enable row level security;

create policy products_select on public.products for select using (company_id in (select public.my_company_ids()));
create policy products_write on public.products for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy movements_select on public.stock_movements for select using (company_id in (select public.my_company_ids()));
create policy movements_insert on public.stock_movements for insert
  with check (company_id in (select public.my_company_ids()));
create policy movements_delete on public.stock_movements for delete
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy service_products_select on public.service_products for select using (company_id in (select public.my_company_ids()));
create policy service_products_write on public.service_products for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));
