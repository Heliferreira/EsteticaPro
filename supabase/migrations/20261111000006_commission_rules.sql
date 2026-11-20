-- Regra de comissão da estética + relatório com valor de cada serviço.
--
-- 1) De quem sai a comissão do vendedor (escolhido na OS, na hora):
--      'estetica' (padrão): sai da parte da estética  -> parceiro recebe a sua parte inteira;
--      'parceiro'          : sai da parte do parceiro -> o vendedor é descontado do parceiro.
--    A % do vendedor é sempre sobre o TOTAL da OS. A soma (parceiro + vendedor + estética) é sempre o total.
--    OS existentes ficam como 'estetica', que é como já funcionavam.
-- 2) O relatório passa a trazer, em cada OS, o preço e a ocorrência de cada peça e o preço de cada item.
--
-- Só adiciona uma coluna (com valor padrão) e substitui a função de cálculo (create or replace).

alter table public.work_order_commissions
  add column if not exists seller_from text not null default 'estetica'
  check (seller_from in ('estetica', 'parceiro'));

create or replace function public.commission_report(p_partner uuid, p_from date, p_to date)
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
      c.seller_id, s.name as seller_name, c.seller_from,
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
             jsonb_agg(jsonb_build_object('part', mk.part_id, 'service', sv.name, 'status', mk.status, 'price', mk.price) order by mk.created_at) as marks
      from public.work_order_marks mk left join public.services sv on sv.id = mk.service_id
      where mk.work_order_id = wo.id
    ) m on true
    left join lateral (
      select sum(it.price) as total,
             jsonb_agg(jsonb_build_object('description', it.description, 'service', sv.name, 'ppf', it.ppf, 'price', it.price) order by it.created_at) as items
      from public.work_order_items it left join public.services sv on sv.id = it.service_id
      where it.work_order_id = wo.id
    ) i on true
    where wo.status in ('done', 'delivered')
      and (wo.done_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
  ), calc as (
    select b.*,
           -- parte do parceiro (% sobre o total), ainda sem descontar o vendedor
           public.commission_amount(b.partner_mode, b.partner_value, b.charged) as partner_share,
           -- comissão do vendedor (% sobre o total)
           case when b.seller_id is null then 0
                else public.commission_amount(b.seller_mode, b.seller_value, b.charged) end as seller_amount
    from base b
  ), fin as (
    select c.*,
           -- o que o parceiro recebe de fato: sua parte, menos a comissão do vendedor se for ele quem paga
           c.partner_share - case when c.seller_from = 'parceiro' then c.seller_amount else 0 end as partner_amount,
           -- o que fica com a estética: o total, menos a parte do parceiro, menos a comissão do vendedor se for ela quem paga
           c.charged - c.partner_share - case when c.seller_from = 'estetica' then c.seller_amount else 0 end as net
    from calc c
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
        'charged', charged, 'partner_share', partner_share, 'partner_amount', partner_amount,
        'seller_id', seller_id, 'seller', seller_name, 'seller_amount', seller_amount, 'seller_from', seller_from,
        'net', net,
        'frozen', report_id is not null
      ) order by done_at, number), '[]'::jsonb),
    'totals', jsonb_build_object(
        'charged', coalesce(sum(charged), 0),
        'partner_amount', coalesce(sum(partner_amount), 0),
        'seller_amount', coalesce(sum(seller_amount), 0),
        'net', coalesce(sum(net), 0),
        'orders', count(*))
  ) into result
  from fin;

  return result;
end
$$;
grant execute on function public.commission_report(uuid, date, date) to authenticated;