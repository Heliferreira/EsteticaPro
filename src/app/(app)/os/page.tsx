import Link from 'next/link';
import { requireContext } from '@/lib/auth';
import { BRL, fmtDate } from '@/lib/actions';
import { OS_STATUS_LABEL, OS_STATUS_ORDER } from '@/lib/os-status';
import { PageHeader, Empty } from '@/components/ui/page';
import type { OsListRow, OsStatus } from '@/types/db';

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const { supabase } = await requireContext();
  const status = OS_STATUS_ORDER.find((s) => s === searchParams.status) as OsStatus | undefined;
  let query = supabase.from('os_list').select('*').order('number', { ascending: false }).limit(200);
  if (status) query = query.eq('status', status);
  const q = (searchParams.q ?? '').trim().replace(/[%,()]/g, '');
  if (q) query = query.or(`customer_name.ilike.%${q}%,plate.ilike.%${q.toUpperCase().replace(/[^A-Z0-9]/g, '')}%,model.ilike.%${q}%`);
  const { data } = await query;
  const rows = (data ?? []) as OsListRow[];

  return (
    <>
      <PageHeader title="Ordens de serviço" action={{ href: '/os/nova', label: 'Nova OS' }} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/os" className={status ? 'btn-ghost' : 'btn'}>Todas</Link>
        {OS_STATUS_ORDER.map((s) => (
          <Link key={s} href={`/os?status=${s}`} className={status === s ? 'btn' : 'btn-ghost'}>{OS_STATUS_LABEL[s]}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>Nenhuma OS encontrada.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Nº</th><th className="th">Entrada</th><th className="th">Cliente</th><th className="th">Veículo</th><th className="th">Responsável</th><th className="th">Status</th><th className="th">Total</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row">
                  <td className="td font-semibold"><Link className="underline" href={`/os/${r.id}`}>#{r.number}</Link></td>
                  <td className="td">{fmtDate(r.entry_at)}</td>
                  <td className="td">{r.customer_name}</td>
                  <td className="td">{r.model} · <span className="font-mono">{r.plate}</span></td>
                  <td className="td">{r.employee_name ?? '—'}</td>
                  <td className="td"><span className="badge">{OS_STATUS_LABEL[r.status]}</span></td>
                  <td className="td">{BRL.format(Number(r.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
