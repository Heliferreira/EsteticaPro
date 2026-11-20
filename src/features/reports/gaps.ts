import type { createClient } from '@/lib/supabase/server';

type Supabase = ReturnType<typeof createClient>;

export interface ReportGaps {
  /** OS concluídas no período que não têm parceiro (vendas diretas): não entram em relatório nenhum. */
  direct: number[];
  /** OS deste parceiro que ainda estão abertas ou em andamento: entram quando forem concluídas. */
  pending: number[];
}

const asList = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Descobre quais OS "ficaram de fora" do relatório, para avisar na tela.
 * Se qualquer consulta falhar, o aviso simplesmente não aparece (o relatório em si não depende disto).
 */
export async function loadReportGaps(supabase: Supabase, partnerId: string, from: string, to: string): Promise<ReportGaps> {
  const gaps: ReportGaps = { direct: [], pending: [] };
  // Brasil não tem horário de verão desde 2019: Brasília é sempre UTC-3.
  const start = `${from}T00:00:00-03:00`;
  const end = `${to}T23:59:59.999-03:00`;

  const done = await supabase
    .from('work_orders')
    .select('number, work_order_commissions ( partner_id )')
    .in('status', ['done', 'delivered'])
    .gte('done_at', start)
    .lte('done_at', end)
    .order('number');
  if (!done.error) {
    (done.data ?? []).forEach((o: { number: number; work_order_commissions: unknown }) => {
      const rows = asList(o.work_order_commissions as { partner_id: string | null } | Array<{ partner_id: string | null }> | null);
      if (!rows.some((r) => r.partner_id)) gaps.direct.push(o.number);
    });
  }

  const open = await supabase
    .from('work_order_commissions')
    .select('work_orders!inner ( number, status )')
    .eq('partner_id', partnerId)
    .in('work_orders.status', ['open', 'in_progress']);
  if (!open.error) {
    (open.data ?? []).forEach((r: { work_orders: unknown }) => {
      asList(r.work_orders as { number: number } | Array<{ number: number }> | null).forEach((w) => gaps.pending.push(w.number));
    });
    gaps.pending.sort((a, b) => a - b);
  }
  return gaps;
}