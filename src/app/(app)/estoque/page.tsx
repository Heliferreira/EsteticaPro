import Link from 'next/link';
import { requireContext, canManage } from '@/lib/auth';
import { fmtQty } from '@/lib/stock';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { deleteProduct } from '@/features/stock/actions';
import type { ProductStockRow } from '@/types/db';

export default async function StockPage({ searchParams }: { searchParams: { q?: string; baixo?: string; erro?: string } }) {
  const { supabase, role } = await requireContext();
  const q = (searchParams.q ?? '').trim().replace(/[%,()]/g, '');
  let query = supabase.from('product_stock').select('*').order('name').limit(300);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  if (searchParams.baixo) query = query.eq('low', true);
  const { data } = await query;
  const rows = (data ?? []) as ProductStockRow[];
  const manage = canManage(role);

  return (
    <>
      <PageHeader title="Estoque" subtitle="Produtos, entradas e saídas. A baixa das OS é automática ao concluí-las."
                  action={manage ? { href: '/estoque/novo', label: 'Novo produto' } : undefined} />
      <ErrorBanner message={searchParams.erro} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou código" className="input max-w-sm" />
        <button className="btn-ghost">Buscar</button>
        <Link href={searchParams.baixo ? '/estoque' : '/estoque?baixo=1'} className={searchParams.baixo ? 'btn' : 'btn-ghost'}>Só estoque baixo</Link>
      </form>
      {rows.length === 0 ? <Empty>Nenhum produto encontrado.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Produto</th><th className="th">Código</th><th className="th">Em estoque</th><th className="th">Mínimo</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="row">
                  <td className="td font-semibold"><Link className="underline" href={`/estoque/${p.id}`}>{p.name}</Link>{!p.active && <span className="muted ml-2 text-xs">inativo</span>}</td>
                  <td className="td font-mono text-xs">{p.sku ?? '—'}</td>
                  <td className="td">
                    {fmtQty(Number(p.stock), p.unit)} {p.low && <span className="badge badge-warn ml-1">baixo</span>}
                  </td>
                  <td className="td">{fmtQty(Number(p.min_stock), p.unit)}</td>
                  <td className="td text-right">
                    {manage && (
                      <form action={deleteProduct} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-danger">Excluir</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
