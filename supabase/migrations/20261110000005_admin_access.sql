-- Acesso administrativo (você) separado do acesso do cliente.
-- Modelo: o cadastro público fica fechado (desligue "Allow new users to sign up" no Supabase).
-- Quem cria empresas e usuários é o painel /admin, usando a service_role no servidor.
-- O admin geral é marcado em auth.users.raw_app_meta_data (campo que o usuário NÃO consegue editar).

-- ---------------------------------------------------------------- suspender empresa
alter table public.companies add column suspended_at timestamptz;

-- empresa suspensa: o RLS passa a esconder todos os dados dela de seus usuários
create or replace function public.my_company_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select m.company_id from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid() and c.suspended_at is null
$$;

create or replace function public.has_company_role(cid uuid, roles public.member_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    join public.companies c on c.id = m.company_id
    where m.company_id = cid and m.user_id = auth.uid() and m.role = any (roles) and c.suspended_at is null
  )
$$;

-- ---------------------------------------------------------------- criação de empresa só pelo admin
-- Usuário comum não cria mais empresa: remove a RPC pública do primeiro MVP.
revoke execute on function public.create_company(text) from authenticated, anon, public;

create function public.admin_create_company(p_name text, p_owner uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if not exists (select 1 from auth.users where id = p_owner) then
    raise exception 'Usuário dono não encontrado.';
  end if;
  insert into public.companies (name) values (trim(p_name)) returning id into cid;
  insert into public.memberships (company_id, user_id, role) values (cid, p_owner, 'owner');
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
revoke all on function public.admin_create_company(text, uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.admin_create_company(text, uuid) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------- o dono gerencia os dados da própria empresa
-- (policies existentes já dão ao dono tudo: cadastros, estoque, equipe, OS, parceiros e relatórios.)
-- Apenas garante que o dono pode editar os dados da empresa (nome, documento, telefone):
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update
  using (public.has_company_role(id, array['owner']::public.member_role[]))
  with check (public.has_company_role(id, array['owner']::public.member_role[]));
