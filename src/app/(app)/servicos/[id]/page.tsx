import { notFound, redirect } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { fmtQty } from '@/lib/stock';
import { PageHeader } from '@/components/ui/page';
import { saveService, addServiceProduct, removeServiceProduct } from '@/features/services/actions';
import { ServiceForm } from '@/features/services/components/ServiceForm';
import { ConsumptionForm } from '@/features/services/components/ConsumptionForm';
import type { Service, Unit } from '@/types/db';

export default async function ServicePage({ params }: { params: { id: string } }) {
  const { supabase, role } = await requireContext();
  if (!canManage(role)) redirect('/servicos');
  let service: Service | null = null;
  let usage: Array<{ id: string; qty: number; products: { name: string; unit: Unit } | null }> = [];
  let products: Array<{ id: string; name: string; unit: string }> = [];
  if (params.id !== 'novo') {
    const { data } = await supabase.from('services').select('*').eq('id', params.id).maybeSingle();
    if (!data) notFound();
    service = data as Service;
    const [u, p] = await Promise.all([
      supabase.from('service_products').select('id, qty, products ( name, unit )').eq('service_id', params.id),
      supabase.from('products').select('id, name, unit').eq('active', true).order('name'),
    ]);
    usage = (u.data ?? []) as unknown as typeof usage;
    products = p.data ?? [];
  }
  return (
    <>
      <PageHeader title={service ? 'Editar serviço' : 'Novo serviço'} />
      <ServiceForm action={saveService.bind(null, params.id)} service={service} />
      {service && (
        <div className="card mt-4 max-w-xl">
          <h2 className="font-display text-xl font-bold">Consumo de produtos</h2>
          <p className="muted text-sm">Quando uma OS com este serviço for concluída, esses produtos saem do estoque.</p>
          <ul className="mt-3 divide-y text-sm">
            {usage.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <span>{u.products?.name} — {u.products ? fmtQty(Number(u.qty), u.products.unit) : u.qty}</span>
                <form action={removeServiceProduct}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="service_id" value={service.id} />
                  <button className="btn-danger">Remover</button>
                </form>
              </li>
            ))}
            {usage.length === 0 && <li className="muted py-2">Nenhum produto vinculado.</li>}
          </ul>
          <ConsumptionForm action={addServiceProduct.bind(null, service.id)} products={products} />
        </div>
      )}
    </>
  );
}
