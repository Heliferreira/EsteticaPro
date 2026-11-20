import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { BRL, fmtDate } from '@/lib/actions';
import { bodyTypeLabel } from '@/lib/car3d/specs';
import { OS_STATUS_LABEL } from '@/lib/os-status';
import { InspectionWorkspace, type MarkRow } from '@/features/orders/components/InspectionWorkspace';
import { updateOrder, addItem, removeItem } from '@/features/orders/actions';
import { AddItemForm, OrderDetailsForm } from '@/features/orders/components/OrderForms';
import { PpfCard } from '@/features/orders/components/PpfCard';
import { ppfAllIds } from '@/lib/car3d/ppf';
import { OrderLive } from '@/features/orders/components/OrderLive';
import { OrderSummary } from '@/features/orders/components/OrderSummary';
import type { Employee, OrderCommission, OsListRow, Partner, Seller, Service, Vehicle, WorkOrderItem, WorkOrderMark } from '@/types/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const { supabase, role } = await requireContext();
  const manage = canManage(role);

  const { data: os } = await supabase.from('os_list').select('*').eq('id', params.id).maybeSingle();
  if (!os) notFound();
  const order = os as OsListRow;

  const [vehicleQ, marksQ, itemsQ, servicesQ, employeesQ, notesQ] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', order.vehicle_id).maybeSingle(),
    supabase.from('work_order_marks').select('*').eq('work_order_id', order.id),
    supabase.from('work_order_items').select('*').eq('work_order_id', order.id).order('created_at'),
    supabase.from('services').select('*').eq('active', true).order('name'),
    supabase.from('employees').select('*').eq('active', true).order('name'),
    supabase.from('work_orders').select('notes').eq('id', order.id).maybeSingle(),
  ]);

  // Comissões e parceiros: só dono/gerente (o RLS também bloqueia o operador).
  let commission: OrderCommission | null = null;
  let partners: Partner[] = [];
  let sellers: Seller[] = [];
  if (manage) {
    const [c, p, sl] = await Promise.all([
      supabase.from('work_order_commissions').select('*').eq('work_order_id', order.id).maybeSingle(),
      supabase.from('partners').select('*').order('name'),
      supabase.from('sellers').select('*').order('name'),
    ]);
    commission = (c.data as OrderCommission | null) ?? null;
    partners = (p.data ?? []) as Partner[];
    sellers = (sl.data ?? []) as Seller[];
  }
  const frozen = !!commission?.report_id;

  const vehicle = vehicleQ.data as Vehicle | null;
  if (!vehicle) notFound();
  const marks = (marksQ.data ?? []) as WorkOrderMark[];
  const items = (itemsQ.data ?? []) as WorkOrderItem[];
  const services = (servicesQ.data ?? []) as Service[];
  const employees = (employeesQ.data ?? []) as Employee[];
  const itemsTotal = items.reduce((s, i) => s + Number(i.price), 0);
  const plainItems = items.filter((i) => !i.ppf);
  const ppfItems = items.filter((i): i is WorkOrderItem & { ppf: NonNullable<WorkOrderItem['ppf']> } => !!i.ppf);
  const ppfCovered = Array.from(new Set(ppfItems.flatMap((i) =>
    i.ppf.mode === 'full' ? ppfAllIds(vehicle.body_type) : i.ppf.parts.map((p) => p.id))));
  const regularServices = services.filter((s) => s.kind !== 'ppf');
  const ppfServices = services.filter((s) => s.kind === 'ppf');
  const readOnly = order.status === 'delivered' || order.status === 'cancelled' || frozen;

  const initialMarks: MarkRow[] = marks.map((m) => ({
    part_id: m.part_id, status: m.status, service_id: m.service_id, price: Number(m.price), note: m.note,
  }));

  return (
    <OrderLive initialMarks={initialMarks}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="muted text-sm"><Link href="/os" className="underline">Ordens de serviço</Link> / #{order.number}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            OS #{order.number} <span className="badge align-middle">{OS_STATUS_LABEL[order.status]}</span>
          </h1>
          <p className="text-sm">
            <b>{order.customer_name}</b> · {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')} ·{' '}
            <span className="font-mono">{vehicle.plate}</span> · {bodyTypeLabel(vehicle.body_type)} · entrada {fmtDate(order.entry_at)}
          </p>
        </div>
        <p className="font-display text-3xl font-bold">{BRL.format(Number(order.total))}</p>
      </div>

      <OrderDetailsForm action={updateOrder.bind(null, order.id)} status={order.status}
                        employeeId={order.employee_id} notes={(notesQ.data?.notes as string | null) ?? null} employees={employees} />

      <h2 className="mb-2 mt-6 font-display text-xl font-bold">Vistoria 3D</h2>
      {frozen && <p className="muted mb-2 text-sm">OS congelada em relatório: serviços e valores estão travados.</p>}
      {readOnly && !frozen && <p className="muted mb-2 text-sm">Esta OS está {OS_STATUS_LABEL[order.status].toLowerCase()} — a vistoria está somente para consulta.</p>}
      <InspectionWorkspace osId={order.id} bodyType={vehicle.body_type} paint={vehicle.color_hex}
                           services={regularServices} itemsTotal={itemsTotal} ppfParts={ppfCovered} readOnly={readOnly} />

      <PpfCard osId={order.id} bodyType={vehicle.body_type} services={ppfServices} readOnly={readOnly} removeAction={removeItem}
               items={ppfItems.map((i) => ({ id: i.id, price: Number(i.price), ppf: i.ppf }))} />

      <h2 className="mb-2 mt-6 font-display text-xl font-bold">Itens avulsos</h2>
      <div className="card">
        {plainItems.length === 0 ? <p className="muted text-sm">Nenhum item avulso.</p> : (
          <ul className="divide-y text-sm" style={{ borderColor: 'var(--line)' }}>
            {plainItems.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2" style={{ borderColor: 'var(--line)' }}>
                <span>{i.description}</span>
                <span className="flex items-center gap-3">
                  {BRL.format(Number(i.price))}
                  {!readOnly && (
                    <form action={removeItem}>
                      <input type="hidden" name="os_id" value={order.id} />
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn-danger">Remover</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && <AddItemForm action={addItem.bind(null, order.id)} services={regularServices} />}
      </div>

      <OrderSummary osId={order.id} bodyType={vehicle.body_type} services={regularServices}
                    items={items.map((i) => ({ id: i.id, description: i.description, price: Number(i.price), ppf: i.ppf }))}
                    manage={manage} partners={partners} sellers={sellers} commission={commission} frozen={frozen} />
          <h2 className="mb-2 mt-6 font-display text-xl font-bold">Ficha para o funcionário</h2>
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <p className="muted max-w-xl text-sm">
          PDF com o veículo e os serviços a executar, pronto para imprimir e deixar no carro. Não mostra nenhum valor.
        </p>
        <a href={`/os/${order.id}/pdf`} className="btn" download>Baixar OS em PDF</a>
      </div>
    </OrderLive>
  );
}