import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireContext, canManage } from '@/lib/auth';
import { uuid } from '@/lib/validation';
import { buildCsv, reportFileName } from '@/features/reports/format';
import { buildPdf } from '@/features/reports/pdf';
import { isYmd } from '@/features/reports/period';
import type { CommissionReport, ReportData } from '@/types/db';

export const runtime = 'nodejs';

const body = z.object({
  format: z.enum(['pdf', 'csv']),
  partner: uuid.optional(),
  from: z.string().refine(isYmd).optional(),
  to: z.string().refine(isYmd).optional(),
  report: uuid.optional(), // baixar de novo um relatório já congelado
  freeze: z.boolean().optional(),
});

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Gera PDF/CSV do relatório; com "freeze" congela as OS do período antes de entregar o arquivo. */
export async function POST(request: NextRequest) {
  // Defesa extra contra requisição vinda de outro site (o cookie já é SameSite=Lax).
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return fail('Origem não permitida.', 403);

  const { supabase, role } = await requireContext();
  if (!canManage(role)) return fail('Sem permissão.', 403);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Pedido inválido.');
  const b = parsed.data;

  let data: ReportData;
  if (b.report) {
    const { data: rep } = await supabase.from('commission_reports').select('*').eq('id', b.report).maybeSingle();
    if (!rep) return fail('Relatório não encontrado.', 404);
    data = (rep as CommissionReport).snapshot;
  } else {
    if (!b.partner || !b.from || !b.to) return fail('Informe parceiro e período.');
    if (b.freeze) {
      const { error } = await supabase.rpc('freeze_report', { p_partner: b.partner, p_from: b.from, p_to: b.to });
      if (error) return fail(error.message);
    }
    const { data: r, error } = await supabase.rpc('commission_report', { p_partner: b.partner, p_from: b.from, p_to: b.to });
    if (error || !r) return fail(error?.message ?? 'Não foi possível gerar o relatório.');
    data = r as ReportData;
  }

  const name = reportFileName(data, b.format);
  const headers = {
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'no-store',
    'X-Filename': name,
  };
  if (b.format === 'csv') {
    return new NextResponse(buildCsv(data), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } });
  }
  return new NextResponse(buildPdf(data), { headers: { ...headers, 'Content-Type': 'application/pdf' } });
}
