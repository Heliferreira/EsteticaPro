import Link from 'next/link';
import { requireContext, canManage } from '@/lib/auth';
import { bodyTypeLabel } from '@/lib/car3d/specs';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { deleteVehicle } from '@/features/vehicles/actions';
import type { Vehicle } from '@/types/db';

type Row = Vehicle & { customers: { name: string } | null };

export default async function VehiclesPage({ searchParams }: { searchParams: { q?: string; erro?: string } }) {
  const { supabase, role } = await requireContext();
  const q = (searchParams.q ?? '').trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  let query = supabase.from('vehicles').select('*, customers ( name )').order('model').limit(200);
  if (q) query = query.or(`plate.ilike.%${q}%,model.ilike.%${q}%,brand.ilike.%${q}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Veículos" action={{ href: '/veiculos/novo', label: 'Novo veículo' }} />
      <ErrorBanner message={searchParams.erro} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por placa, marca ou modelo" className="input max-w-sm" />
        <button className="btn-ghost">Buscar</button>
      </form>
      {rows.length === 0 ? <Empty>Nenhum veículo encontrado.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Placa</th><th className="th">Veículo</th><th className="th">Tipo</th><th className="th">Dono</th><th className="th" /></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="row">
                  <td className="td font-mono font-semibold"><Link className="underline" href={`/veiculos/${v.id}`}>{v.plate}</Link></td>
                  <td className="td">
                    <span className="mr-2 inline-block h-3 w-3 rounded-full border align-middle" style={{ background: v.color_hex, borderColor: 'var(--line)' }} />
                    {[v.brand, v.model, v.year].filter(Boolean).join(' ')}
                  </td>
                  <td className="td">{bodyTypeLabel(v.body_type)}</td>
                  <td className="td">{v.customers?.name ?? '—'}</td>
                  <td className="td text-right">
                    {canManage(role) && (
                      <form action={deleteVehicle} className="inline">
                        <input type="hidden" name="id" value={v.id} />
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
