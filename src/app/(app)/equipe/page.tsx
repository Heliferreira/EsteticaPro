import Link from 'next/link';
import { requireContext, canManage } from '@/lib/auth';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { deleteEmployee } from '@/features/team/actions';
import type { Employee } from '@/types/db';

export default async function TeamPage({ searchParams }: { searchParams: { erro?: string } }) {
  const { supabase, role } = await requireContext();
  const { data } = await supabase.from('employees').select('*').order('name');
  const rows = (data ?? []) as Employee[];
  const manage = canManage(role);
  return (
    <>
      <PageHeader title="Equipe" subtitle="Funcionários que podem ser responsáveis por uma OS."
                  action={manage ? { href: '/equipe/novo', label: 'Novo funcionário' } : undefined} />
      <ErrorBanner message={searchParams.erro} />
      {rows.length === 0 ? <Empty>Nenhum funcionário cadastrado.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Nome</th><th className="th">Função</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="row">
                  <td className="td font-semibold">{manage ? <Link className="underline" href={`/equipe/${e.id}`}>{e.name}</Link> : e.name}</td>
                  <td className="td">{e.role_title ?? '—'}</td>
                  <td className="td">{e.active ? <span className="badge">Ativo</span> : <span className="muted text-xs">Inativo</span>}</td>
                  <td className="td text-right">
                    {manage && (
                      <form action={deleteEmployee} className="inline">
                        <input type="hidden" name="id" value={e.id} />
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
