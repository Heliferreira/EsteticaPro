import { NextResponse } from 'next/server';
import { requireContext } from '@/lib/auth';
import { bodyTypeLabel } from '@/lib/car3d/specs';
import { markStatusInfo } from '@/lib/car3d/marks';
import { partName } from '@/lib/car3d/names';
import { OS_STATUS_LABEL } from '@/lib/os-status';
import { buildOsPdf, type OsSheet } from '@/features/orders/pdf';
import type { BodyType, OsListRow, PpfData } from '@/types/db';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ficha da OS para o funcionário (PDF para imprimir). Sem nenhum valor em reais:
 * as consultas abaixo escolhem as colunas uma a uma e NUNCA pedem "price".
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'OS inválida.' }, { status: 400 });
  const { supabase } = await requireContext();

  const { data: os } = await supabase
    .from('os_list')
    .select('id, number, status, entry_at, customer_id, vehicle_id, customer_name, employee_name')
    .eq('id', params.id)
    .maybeSingle();
  if (!os) return NextResponse.json({ error: 'OS não encontrada.' }, { status: 404 });
  const order = os as Pick<OsListRow, 'number' | 'status' | 'entry_at' | 'customer_id' | 'vehicle_id' | 'customer_name' | 'employee_name'>;

  const [customerQ, vehicleQ, marksQ, itemsQ, servicesQ, notesQ] = await Promise.all([
    supabase.from('customers').select('phone').eq('id', order.customer_id).maybeSingle(),
    supabase.from('vehicles').select('plate, brand, model, year, color, body_type').eq('id', order.vehicle_id).maybeSingle(),
    supabase.from('work_order_marks').select('part_id, status, service_id, note').eq('work_order_id', params.id).order('created_at'),
    supabase.from('work_order_items').select('description, ppf').eq('work_order_id', params.id).order('created_at'),
    supabase.from('services').select('id, name'),
    supabase.from('work_orders').select('notes').eq('id', params.id).maybeSingle(),
  ]);

  const v = vehicleQ.data as { plate: string; brand: string | null; model: string; year: number | null; color: string | null; body_type: BodyType } | null;
  if (!v) return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 });
  const serviceName = new Map(((servicesQ.data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));

  const tasks: OsSheet['tasks'] = [];
  for (const m of (marksQ.data ?? []) as Array<{ part_id: string; status: string; service_id: string | null; note: string | null }>) {
    const occurrence = m.status === 'ok' ? null : markStatusInfo(m.status).label;
    const service = m.service_id ? serviceName.get(m.service_id) ?? null : null;
    tasks.push({
      group: 'Vistoria 3D',
      title: partName(v.body_type, m.part_id),
      detail: [occurrence, service].filter(Boolean).join(' · ') || null,
      note: m.note,
    });
  }
  for (const i of (itemsQ.data ?? []) as Array<{ description: string; ppf: PpfData | null }>) {
    if (i.ppf) {
      tasks.push({
        group: 'PPF',
        title: i.ppf.mode === 'full' ? 'PPF Full (carro completo)' : 'PPF por partes',
        detail: i.ppf.mode === 'full' ? null : i.ppf.parts.map((p) => partName(v.body_type, p.id)).join(', '),
        note: null,
      });
    } else {
      tasks.push({ group: 'Itens avulsos', title: i.description, detail: null, note: null });
    }
  }

  const sheet: OsSheet = {
    number: order.number,
    entryAt: order.entry_at,
    status: OS_STATUS_LABEL[order.status],
    employee: order.employee_name,
    customer: order.customer_name,
    phone: (customerQ.data as { phone: string | null } | null)?.phone ?? null,
    vehicle: [v.brand, v.model, v.year].filter(Boolean).join(' '),
    plate: v.plate,
    color: v.color,
    bodyType: bodyTypeLabel(v.body_type),
    tasks,
    notes: (notesQ.data as { notes: string | null } | null)?.notes ?? null,
  };

  const name = `os-${order.number}-${v.plate.toLowerCase()}.pdf`;
  return new NextResponse(buildOsPdf(sheet), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}