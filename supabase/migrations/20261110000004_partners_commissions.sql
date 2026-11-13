-- Parceiros (ex.: revendedoras), vendedores, comissões por OS e relatórios.
-- Regra de privacidade: tudo que envolve comissão e valor combinado com parceiro
-- só pode ser lido/alterado por dono e gerente. Operadores abrem OS normalmente,
-- mas não enxergam parceiro, comissão nem relatórios.

-- ---------------------------------------------------------------- data de conclusão da OS
alter table public.work_orders add column done_at timestamptz;

update public.work_orders set done_at = updated_at where status in ('done', 'delivered');

create function public.set_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('done', 'delivered') then
    if new.done_at is null then new.done_at = now(); end if;
  else
    new.done_at = null;
  end if;
  return new;
end
$$;

create trigger work_orders_done_at
before insert or update of status on public.work_orders
for each row execute function public.set_done_at();

alter table public.company_counters add column report_seq int not null default 0;

-- ---------------------------------------------------------------- parceiros e vendedores
create table public.partners (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 120),
  pct_default numeric(5, 2) not null default 0 check (pct_default between 0 and 100),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, company_id)
);
create index partners_company_idx on public.partners (company_id, name);

create table public.sellers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  partner_id  uuid not null,
  name        text not null check (char_length(name) between 2 and 120),
  pct_default numeric(5, 2) not null default 0 check (pct_default between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, company_id),
  unique (id, partner_id),
  foreign key (partner_id, company_id) references public.partners (id, company_id) on delete cascade
);
create index sellers_partner_idx on public.sellers (partner_id);

create trigger partners_touch before update on public.partners for each row execute function public.touch_updated_at();
create trigger sellers_touch  before update on public.sellers  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- relatórios congelados
create table public.commission_reports (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  partner_id  uuid not null,
  number      int  not null,
  period_from date not null,
  period_to   date not null check (period_to >= period_from),
  snapshot    jsonb not null,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, number),
  foreign key (partner_id, company_id) references public.partners (id, company_id)
);
create index commission_reports_idx on public.commission_reports (company_id, created_at desc);

-- ---------------------------------------------------------------- comissões por OS (1 linha por OS, opcional)
-- A OS funciona sem esta linha. report_id preenchido = OS congelada.
create table public.work_order_commissions (
  work_order_id  uuid primary key,
  company_id     uuid not null references public.companies (id) on delete cascade,
  partner_id     uuid,
  seller_id      uuid,
  charged        numeric(12, 2) check (charged is null or charged >= 0),
  partner_mode   text not null default 'pct' check (partner_mode in ('pct', 'val')),
  partner_value  numeric(12, 2) check (partner_value is null or partner_value >= 0),
  seller_mode    text not null default 'pct' check (seller_mode in ('pct', 'val')),
  seller_value   numeric(12, 2) check (seller_value is null or seller_value >= 0),
  report_id      uuid,
  updated_at     timestamptz not null default now(),
  check (partner_mode <> 'pct' or partner_value is null or partner_value <= 100),
  check (seller_mode  <> 'pct' or seller_value  is null or seller_value  <= 100),
  check (seller_id is null or partner_id is not null),
  foreign key (work_order_id, company_id) references public.work_orders (id, company_id) on delete cascade,
  foreign key (partner_id, company_id)    references public.partners (id, company_id),
  foreign key (seller_id, partner_id)     references public.sellers (id, partner_id),
  foreign key (report_id, company_id)     references public.commission_reports (id, company_id) on delete set null (report_id)
);
create index work_order_commissions_partner_idx on public.work_order_commissions (company_id, partner_id);

create trigger commissions_touch before update on public.work_order_commissions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- OS congelada não muda
create function public.is_order_frozen(p_order uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.work_order_commissions where work_order_id = p_order and report_id is not null)
$$;

create function public.block_if_frozen()
returns trigger
language plpgsql
as $$
declare
  oid uuid;
begin
  if tg_table_name = 'work_orders' then
    oid := coalesce(old.id, new.id);
  else
    oid := coalesce(old.work_order_id, new.work_order_id);
  end if;
  if public.is_order_frozen(oid) then
    raise exception 'Esta OS está congelada em um relatório. Reabra o período para editar.';
  end if;
  return coalesce(new, old);
end
$$;

create trigger work_orders_frozen before update or delete on public.work_orders
  for each row execute function public.block_if_frozen();
create trigger marks_frozen before insert or update or delete on public.work_order_marks
  for each row execute function public.block_if_frozen();
create trigger items_frozen before insert or update or delete on public.work_order_items
  for each row execute function public.block_if_frozen();

-- na linha de comissão só o campo report_id pode mudar quando congelada (congelar/reabrir)
create function public.block_commission_if_frozen()
returns trigger
language plpgsql
as $$
begin
  if old.report_id is not null then
    if tg_op = 'DELETE' then
      raise exception 'Esta OS está congelada em um relatório. Reabra o período para editar.';
    end if;
    if (to_jsonb(new) - 'report_id' - 'updated_at') is distinct from (to_jsonb(old) - 'report_id' - 'updated_at') then
      raise exception 'Esta OS está congelada em um relatório. Reabra o período para editar.';
    end if;
  end if;
  return coalesce(new, old);
end
$$;

create trigger commissions_frozen before update or delete on public.work_order_commissions
  for each row execute function public.block_commission_if_frozen();

-- ---------------------------------------------------------------- valor da comissão
create function public.commission_amount(p_mode text, p_value numeric, p_base numeric)
returns numeric
language sql immutable
as $$
  select case
    when p_value is null then 0
    when p_mode = 'pct' then round(p_base * p_value / 100, 2)
    else p_value
  end
$$;

-- ---------------------------------------------------------------- relatório (cálculo)
-- Devolve as OS concluídas do parceiro no período (data = conclusão, fuso de Brasília),
-- já com valores calculados. Só dono e gerente.
create function public.commission_report(p_partner uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  cid uuid;
  pname text;
  result jsonb;
begin
  select company_id, name into cid, pname from public.partners where id = p_partner;
  if cid is null or not public.has_company_role(cid, array['owner','manager']::public.member_role[]) then
    raise exception 'Sem permissão para este relatório.';
  end if;
  if p_to < p_from then
    raise exception 'A data final precisa ser igual ou depois da inicial.';
  end if;

  with base as (
    select
      wo.id, wo.number, wo.done_at,
      (wo.done_at at time zone 'America/Sao_Paulo')::date as day,
      v.brand, v.model, v.year, v.plate, v.body_type,
      c.seller_id, s.name as seller_name,
      c.report_id,
      coalesce(c.charged, coalesce(m.total, 0) + coalesce(i.total, 0)) as charged,
      c.partner_mode, c.partner_value, c.seller_mode, c.seller_value,
      coalesce(m.marks, '[]'::jsonb) as marks,
      coalesce(i.items, '[]'::jsonb) as items
    from public.work_orders wo
    join public.work_order_commissions c on c.work_order_id = wo.id and c.partner_id = p_partner
    join public.vehicles v on v.id = wo.vehicle_id
    left join public.sellers s on s.id = c.seller_id
    left join lateral (
      select sum(mk.price) as total,
             jsonb_agg(jsonb_build_object('part', mk.part_id, 'service', sv.name) order by mk.created_at) as marks
      from public.work_order_marks mk left join public.services sv on sv.id = mk.service_id
      where mk.work_order_id = wo.id
    ) m on true
    left join lateral (
      select sum(it.price) as total,
             jsonb_agg(jsonb_build_object('description', it.description, 'service', sv.name, 'ppf', it.ppf) order by it.created_at) as items
      from public.work_order_items it left join public.services sv on sv.id = it.service_id
      where it.work_order_id = wo.id
    ) i on true
    where wo.status in ('done', 'delivered')
      and (wo.done_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
  ), calc as (
    select b.*,
           public.commission_amount(b.partner_mode, b.partner_value, b.charged) as partner_amount,
           public.commission_amount(b.seller_mode,  b.seller_value,  b.charged) as seller_amount
    from base b
  )
  select jsonb_build_object(
    'partner_id', p_partner,
    'partner', pname,
    'from', p_from,
    'to', p_to,
    'rows', coalesce(jsonb_agg(jsonb_build_object(
        'order_id', id, 'number', number, 'date', day,
        'vehicle', trim(concat_ws(' ', brand, model, year::text)), 'plate', plate, 'body_type', body_type,
        'marks', marks, 'items', items,
        'charged', charged, 'partner_amount', partner_amount,
        'seller_id', seller_id, 'seller', seller_name, 'seller_amount', seller_amount,
        'net', charged - partner_amount - seller_amount,
        'frozen', report_id is not null
      ) order by done_at, number), '[]'::jsonb),
    'totals', jsonb_build_object(
        'charged', coalesce(sum(charged), 0),
        'partner_amount', coalesce(sum(partner_amount), 0),
        'seller_amount', coalesce(sum(seller_amount), 0),
        'net', coalesce(sum(charged - partner_amount - seller_amount), 0),
        'orders', count(*))
  ) into result
  from calc;

  return result;
end
$$;
grant execute on function public.commission_report(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------- congelar e reabrir
create function public.freeze_report(p_partner uuid, p_from date, p_to date)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
  snap jsonb;
  rid uuid;
  n int;
begin
  select company_id into cid from public.partners where id = p_partner;
  if cid is null or not public.has_company_role(cid, array['owner','manager']::public.member_role[]) then
    raise exception 'Sem permissão para este relatório.';
  end if;

  snap := public.commission_report(p_partner, p_from, p_to);
  if (snap -> 'totals' ->> 'orders')::int = 0 then
    raise exception 'Não há OS concluídas deste parceiro no período.';
  end if;
  if not exists (select 1 from jsonb_array_elements(snap -> 'rows') r where (r ->> 'frozen')::boolean = false) then
    raise exception 'Todas as OS deste período já estão congeladas.';
  end if;

  update public.company_counters set report_seq = report_seq + 1 where company_id = cid returning report_seq into n;
  insert into public.commission_reports (company_id, partner_id, number, period_from, period_to, snapshot, created_by)
  values (cid, p_partner, n, p_from, p_to, snap, auth.uid())
  returning id into rid;

  update public.work_order_commissions
     set report_id = rid
   where company_id = cid and report_id is null
     and work_order_id in (select (r ->> 'order_id')::uuid from jsonb_array_elements(snap -> 'rows') r);
  return rid;
end
$$;
grant execute on function public.freeze_report(uuid, date, date) to authenticated;

-- apagar o relatório devolve as OS ao estado editável (FK on delete set null)
create function public.reopen_report(p_report uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  select company_id into cid from public.commission_reports where id = p_report;
  if cid is null or not public.has_company_role(cid, array['owner','manager']::public.member_role[]) then
    raise exception 'Sem permissão para reabrir este relatório.';
  end if;
  delete from public.commission_reports where id = p_report;
end
$$;
grant execute on function public.reopen_report(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.partners                enable row level security;
alter table public.sellers                 enable row level security;
alter table public.work_order_commissions  enable row level security;
alter table public.commission_reports      enable row level security;

create policy partners_all on public.partners for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy sellers_all on public.sellers for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy commissions_all on public.work_order_commissions for all
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]))
  with check (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));

create policy reports_select on public.commission_reports for select
  using (public.has_company_role(company_id, array['owner','manager']::public.member_role[]));
-- criar/apagar relatórios só pelas funções freeze_report / reopen_report (sem policy de escrita direta).
