import Link from 'next/link';
import { requireContext } from '@/lib/auth';
import { BRL } from '@/lib/actions';
import { fmtQty } from '@/lib/stock';
import { OS_STATUS_LABEL } from '@/lib/os-status';
import { Icon } from '@/components/ui/Icon';
import type { OsListRow, Unit } from '@/types/db';

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default async function DashboardPage() {
  const { supabase } = await requireContext();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [open, customers, vehicles, month, latest, lowStock, monthOs] = await Promise.all([
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('vehicles').select('id', { count: 'exact', head: true }),
    supabase.from('os_list').select('total').in('status', ['done', 'delivered']).gte('entry_at', monthStart.toISOString()),
    supabase.from('os_list').select('*').order('number', { ascending: false }).limit(3),
    supabase.from('product_stock').select('id, name, stock, unit, min_stock').eq('low', true).eq('active', true).order('name').limit(5),
    supabase.from('work_orders').select('entry_at').gte('entry_at', monthStart.toISOString()).lt('entry_at', nextMonth.toISOString()),
  ]);

  const revenue = (month.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const rows = (latest.data ?? []) as OsListRow[];
  const low = (lowStock.data ?? []) as Array<{ id: string; name: string; stock: number; unit: Unit; min_stock: number }>;

  // calendário: dias do mês com OS aberta
  const activeDays = new Set((monthOs.data ?? []).map((r) => new Date(r.entry_at as string).getDate()));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = monthStart.getDay();
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });

  const stats = [
    { label: 'OS em andamento', value: String(open.count ?? 0), sub: 'abertas ou em execução' },
    { label: 'Faturado no mês', value: BRL.format(revenue), sub: 'OS concluídas e entregues' },
    { label: 'Clientes', value: String(customers.count ?? 0), sub: `${vehicles.count ?? 0} veículos cadastrados` },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="card">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="my-3 text-3xl font-semibold tracking-tight">{s.value}</p>
              <p className="muted text-xs">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium">Estoque baixo</p>
            <Link href="/estoque?baixo=1" className="muted text-xs underline">ver todos</Link>
          </div>
          {low.length === 0 ? (
            <p className="muted text-sm">Tudo certo: nenhum produto abaixo do mínimo.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {low.map((p) => (
                <li key={p.id}>
                  <Link href={`/estoque/${p.id}`} className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                        style={{ background: 'var(--surface-2)' }}>
                    <span className="font-medium">{p.name}</span>
                    <span className="badge badge-warn">{fmtQty(Number(p.stock), p.unit)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium">Últimas ordens de serviço</p>
            <Link href="/os" className="muted text-xs underline">ver todas</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r, i) => (
              <Link key={r.id} href={`/os/${r.id}`}
                    className="flex min-h-[120px] flex-col justify-between rounded-3xl p-4"
                    style={i === 0 ? { background: 'var(--blue)', color: '#fff' } : { background: 'var(--surface-2)' }}>
                <div className="flex items-start justify-between">
                  <span className="text-xs opacity-80">#{r.number}</span>
                  <Icon name="arrow" size={16} />
                </div>
                <div>
                  <p className="font-semibold leading-tight">{r.model}</p>
                  <p className="font-mono text-xs opacity-80">{r.plate}</p>
                  <p className="mt-1 text-xs opacity-80">{OS_STATUS_LABEL[r.status]} · {BRL.format(Number(r.total))}</p>
                </div>
              </Link>
            ))}
            <Link href="/os/nova" className="card-dashed flex min-h-[120px] flex-col items-center justify-center gap-1 text-sm font-medium">
              <Icon name="plus" size={22} /> Nova OS
            </Link>
          </div>
        </div>
      </div>

      <div className="card-blue h-fit">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Dias com OS</p>
          <span className="text-sm capitalize opacity-90">{monthName}</span>
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center text-[11px] opacity-80">
          {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {Array.from({ length: offset }).map((_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const isToday = d === now.getDate();
            const has = activeDays.has(d);
            return (
              <span key={d} className="flex aspect-square items-center justify-center rounded-full text-xs"
                    style={isToday
                      ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }
                      : has ? { background: '#16162b', color: '#fff' } : { background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.85)' }}>
                {d}
              </span>
            );
          })}
        </div>
        <p className="mt-4 text-xs opacity-80">Escuros: dias com OS aberta. Amarelo: hoje.</p>
      </div>
    </div>
  );
}
