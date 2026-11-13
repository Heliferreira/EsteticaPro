import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { fmtDate } from '@/lib/actions';
import { KIND_LABEL, fmtQty } from '@/lib/stock';
import { PageHeader } from '@/components/ui/page';
import { saveProduct, addMovement } from '@/features/stock/actions';
import { MovementForm, ProductForm } from '@/features/stock/components/StockForms';
import type { ProductStockRow, StockMovement } from '@/types/db';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const { supabase, role } = await requireContext();
  let product: ProductStockRow | null = null;
  let moves: StockMovement[] = [];
  if (params.id !== 'novo') {
    const { data } = await supabase.from('product_stock').select('*').eq('id', params.id).maybeSingle();
    if (!data) notFound();
    product = data as ProductStockRow;
    const m = await supabase.from('stock_movements').select('*').eq('product_id', params.id).order('created_at', { ascending: false }).limit(30);
    moves = (m.data ?? []) as StockMovement[];
  }
  return (
    <>
      <PageHeader title={product ? product.name : 'Novo produto'}
                  subtitle={product ? `Em estoque: ${fmtQty(Number(product.stock), product.unit)}` : undefined} />
      <ProductForm action={saveProduct.bind(null, params.id)} product={product} canEdit={canManage(role)} />
      {product && (
        <>
          <MovementForm action={addMovement.bind(null, params.id)} unit={product.unit} />
          <h2 className="mb-2 mt-6 font-display text-xl font-bold">Últimas movimentações</h2>
          <div className="card overflow-x-auto !p-0">
            <table className="w-full">
              <thead><tr><th className="th">Data</th><th className="th">Tipo</th><th className="th">Quantidade</th><th className="th">Observação</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="row">
                    <td className="td">{fmtDate(m.created_at)}</td>
                    <td className="td">{KIND_LABEL[m.kind]}</td>
                    <td className="td">{Number(m.qty) > 0 ? '+' : ''}{fmtQty(Number(m.qty), product.unit)}</td>
                    <td className="td">
                      {m.note ?? '—'} {m.work_order_id && <Link href={`/os/${m.work_order_id}`} className="underline">ver OS</Link>}
                    </td>
                  </tr>
                ))}
                {moves.length === 0 && <tr><td className="td muted" colSpan={4}>Sem movimentações.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
