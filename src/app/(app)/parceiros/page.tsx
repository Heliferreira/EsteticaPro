import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { deletePartner } from '@/features/partners/actions';
import type { Partner } from '@/types/db';

export default async function PartnersPage({ searchParams }: { searchParams: { erro?: string } }) {
  const { supabase, role } = await requireContext();
  if (!canManage(role)) redirect('/dashboard');
  const [partnersQ, sellersQ] = await Promise.all([
    supabase.from('partners').select('*').order('name'),
    supabase.from('sellers').select('partner_id'),
  ]);
  const rows = (partnersQ.data ?? []) as Partner[];
  const count = new Map<string, number>();
  (sellersQ.data ?? []).forEach((s) => count.set(s.partner_id as string, (count.get(s.partner_id as string) ?? 0) + 1));

  return (
    <>
      <PageHeader title="Parceiros" subtitle="Empresas que revendem seus serviços (ex.: revendedoras de carros) e recebem relatórios com comissões."
                  action={{ href: '/parceiros/novo', label: 'Novo parceiro' }} />
      <ErrorBanner message={searchParams.erro} />
      {rows.length === 0 ? <Empty>Nenhum parceiro cadastrado.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Parceiro</th><th className="th">Comissão padrão</th><th className="th">Vendedores</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="row">
                  <td className="td font-semibold"><Link className="underline" href={`/parceiros/${p.id}`}>{p.name}</Link></td>
                  <td className="td">{String(p.pct_default).replace('.', ',')}%</td>
                  <td className="td">{count.get(p.id) ?? 0}</td>
                  <td className="td text-right">
                    <form action={deletePartner} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn-danger">Excluir</button>
                    </form>
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
