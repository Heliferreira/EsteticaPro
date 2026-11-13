import Link from 'next/link';
import { requireContext, canManage } from '@/lib/auth';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { deleteCustomer } from '@/features/customers/actions';
import type { Customer } from '@/types/db';

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string; erro?: string } }) {
  const { supabase, role } = await requireContext();
  const q = (searchParams.q ?? '').trim().replace(/[%,()]/g, '');
  let query = supabase.from('customers').select('*').order('name').limit(200);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const { data } = await query;
  const rows = (data ?? []) as Customer[];

  return (
    <>
      <PageHeader title="Clientes" action={{ href: '/clientes/novo', label: 'Novo cliente' }} />
      <ErrorBanner message={searchParams.erro} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou e-mail" className="input max-w-sm" />
        <button className="btn-ghost">Buscar</button>
      </form>
      {rows.length === 0 ? <Empty>Nenhum cliente encontrado.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Nome</th><th className="th">Telefone</th><th className="th">E-mail</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="row">
                  <td className="td font-semibold"><Link href={`/clientes/${c.id}`} className="underline">{c.name}</Link></td>
                  <td className="td">{c.phone ?? '—'}</td>
                  <td className="td">{c.email ?? '—'}</td>
                  <td className="td text-right">
                    <Link href={`/veiculos/novo?cliente=${c.id}`} className="muted mr-3 text-xs underline">+ veículo</Link>
                    {canManage(role) && (
                      <form action={deleteCustomer} className="inline">
                        <input type="hidden" name="id" value={c.id} />
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
