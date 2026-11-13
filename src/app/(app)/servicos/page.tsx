import Link from 'next/link';
import { requireContext, canManage } from '@/lib/auth';
import { BRL } from '@/lib/actions';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { deleteService } from '@/features/services/actions';
import type { Service } from '@/types/db';

export default async function ServicesPage({ searchParams }: { searchParams: { erro?: string } }) {
  const { supabase, role } = await requireContext();
  const { data } = await supabase.from('services').select('*').order('name');
  const rows = (data ?? []) as Service[];
  const manage = canManage(role);
  return (
    <>
      <PageHeader title="Serviços" subtitle="Catálogo com preço padrão (o preço pode ser ajustado em cada OS)."
                  action={manage ? { href: '/servicos/novo', label: 'Novo serviço' } : undefined} />
      <ErrorBanner message={searchParams.erro} />
      {rows.length === 0 ? <Empty>Nenhum serviço cadastrado.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Serviço</th><th className="th">Preço</th><th className="th">Tempo est.</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="row">
                  <td className="td font-semibold">
                    {manage ? <Link className="underline" href={`/servicos/${s.id}`}>{s.name}</Link> : s.name}
                    {s.kind === 'ppf' && <span className="badge ml-2">PPF</span>}
                  </td>
                  <td className="td">
                    {BRL.format(Number(s.default_price))}
                    {s.kind === 'ppf' && <span className="muted ml-2 text-xs">Full · {BRL.format(Number(s.part_price))}/parte</span>}
                  </td>
                  <td className="td">{s.est_minutes ? `${s.est_minutes} min` : '—'}</td>
                  <td className="td">{s.active ? <span className="badge">Ativo</span> : <span className="muted text-xs">Inativo</span>}</td>
                  <td className="td text-right">
                    {manage && (
                      <form action={deleteService} className="inline">
                        <input type="hidden" name="id" value={s.id} />
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
