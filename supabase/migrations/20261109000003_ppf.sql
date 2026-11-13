-- ============================================================================
-- PPF (Full ou por partes) e polimento de para-brisa
-- ============================================================================

alter table public.services
  add column kind text not null default 'standard' check (kind in ('standard', 'ppf')),
  add column part_price numeric(12, 2) not null default 0 check (part_price >= 0);

-- Item da OS pode carregar a aplicação de PPF:
--   {"mode": "full", "parts": []}  ou  {"mode": "parts", "parts": [{"id": "hood", "price": 450}, ...]}
alter table public.work_order_items
  add column ppf jsonb check (
    ppf is null or (
      jsonb_typeof(ppf) = 'object'
      and ppf ->> 'mode' in ('full', 'parts')
      and jsonb_typeof(ppf -> 'parts') = 'array'
    )
  );

-- novos serviços para as empresas que já existem
insert into public.services (company_id, name, default_price, est_minutes, kind, part_price)
select c.id, 'Polimento de para-brisa', 120, 60, 'standard', 0
from public.companies c
where not exists (select 1 from public.services s where s.company_id = c.id and s.name = 'Polimento de para-brisa');

insert into public.services (company_id, name, default_price, est_minutes, kind, part_price)
select c.id, 'PPF (película de proteção)', 6500, 480, 'ppf', 450
from public.companies c
where not exists (select 1 from public.services s where s.company_id = c.id and s.kind = 'ppf');

-- novas empresas já nascem com os serviços
create or replace function public.create_company(p_name text)
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
  insert into public.services (company_id, name, default_price, est_minutes, kind, part_price) values
    (cid, 'Lavagem detalhada',          80,  90, 'standard', 0),
    (cid, 'Polimento comercial',       150, 120, 'standard', 0),
    (cid, 'Polimento técnico',         280, 240, 'standard', 0),
    (cid, 'Remoção de riscos',         120,  90, 'standard', 0),
    (cid, 'Vitrificação',              450, 300, 'standard', 0),
    (cid, 'Martelinho de ouro',        180, 120, 'standard', 0),
    (cid, 'Polimento de faróis',        90,  60, 'standard', 0),
    (cid, 'Polimento de para-brisa',   120,  60, 'standard', 0),
    (cid, 'Aplicação de película',     220, 180, 'standard', 0),
    (cid, 'Higienização',              150, 120, 'standard', 0),
    (cid, 'PPF (película de proteção)', 6500, 480, 'ppf', 450);
  return cid;
end
$$;
