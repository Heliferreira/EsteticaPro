import { markStatusInfo } from '@/lib/car3d/marks';
import { partName } from '@/lib/car3d/names';
import type { ReportData, ReportRow } from '@/types/db';
import { brDate } from './period';

export const partLabel = partName;

export interface ServiceLine { label: string; price: number | null }

/**
 * Uma linha por serviço da OS, com o valor de cada um (quando o relatório tem esse dado).
 * Peça marcada sem serviço escolhido aparece com a ocorrência, em vez de sumir.
 */
export function serviceLines(row: ReportRow): ServiceLine[] {
  const lines: ServiceLine[] = [];
  row.marks.forEach((m) => {
    const price = m.price != null ? Number(m.price) : null;
    const part = partName(row.body_type, m.part);
    if (m.service) {
      lines.push({ label: `${m.service} (${part})`, price });
    } else if ((m.status && m.status !== 'ok') || (price ?? 0) > 0) {
      const what = m.status && m.status !== 'ok' ? markStatusInfo(m.status).label : 'Sem serviço definido';
      lines.push({ label: `${part} · ${what}`, price });
    }
  });
  row.items.forEach((i) => {
    const price = i.price != null ? Number(i.price) : null;
    if (i.ppf) {
      lines.push({
        label: i.ppf.mode === 'full'
          ? 'PPF Full (carro completo)'
          : `PPF: ${i.ppf.parts.map((p) => partName(row.body_type, p.id)).join(', ')}`,
        price,
      });
    } else {
      lines.push({ label: i.description, price });
    }
  });
  return lines;
}

/** Texto dos serviços da OS em uma linha só (usado no CSV). Com valores, quando existirem. */
export function describeServices(row: ReportRow, withPrice = false): string {
  const out = serviceLines(row).map((l) =>
    withPrice && l.price != null ? `${l.label}: ${money(l.price)}` : l.label);
  return out.join('; ') || '—';
}

/** De quem saiu a comissão do vendedor naquela OS (relatórios antigos não têm o dado: valem como estética). */
export function sellerSource(r: ReportRow): string | null {
  if (!r.seller) return null;
  return r.seller_from === 'parceiro' ? 'sai da parte do parceiro' : 'sai da parte da estética';
}

/** Prestação de contas: como o total cobrado se divide entre parceiro, vendedores e estética. */
export function reportSummary(d: ReportData) {
  return {
    charged: Number(d.totals.charged),
    partner: Number(d.totals.partner_amount),
    sellers: Number(d.totals.seller_amount),
    net: Number(d.totals.net),
  };
}

export const BRL_FMT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** Moeda sem o espaço não separável (NBSP), que o PDF padrão não desenha bem. */
export const money = (n: number) => BRL_FMT.format(n).replace(/[\u00A0\u202F]/g, ' ');
const csvMoney = (n: number) => Number(n).toFixed(2).replace('.', ',');
export const periodLabel = (d: Pick<ReportData, 'from' | 'to'>) => `${brDate(d.from)} a ${brDate(d.to)}`;

/** Comissão total por pessoa (parceiro + cada vendedor). */
export function personTotals(d: ReportData): Array<{ name: string; role: string; orders: number; total: number }> {
  const sellers = new Map<string, { name: string; role: string; orders: number; total: number }>();
  d.rows.forEach((r) => {
    if (!r.seller_id || !r.seller) return;
    const cur = sellers.get(r.seller_id) ?? { name: r.seller, role: 'Vendedor', orders: 0, total: 0 };
    cur.orders += 1;
    cur.total += Number(r.seller_amount);
    sellers.set(r.seller_id, cur);
  });
  return [
    { name: d.partner, role: 'Parceiro', orders: d.totals.orders, total: Number(d.totals.partner_amount) },
    ...sellers.values(),
    { name: 'Estética', role: 'Dono da estética', orders: d.totals.orders, total: Number(d.totals.net) },
  ];
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV pronto para o Excel em português: separador ";", vírgula decimal e BOM UTF-8 (acentos). */
export function buildCsv(d: ReportData): string {
  const sum = reportSummary(d);
  const lines: Array<Array<string | number>> = [
    ['Relatório de serviços em parceria'],
    ['Parceiro', d.partner],
    ['Período', periodLabel(d)],
    [],
    ['Prestação de contas'],
    ['Total cobrado', csvMoney(sum.charged)],
    [`Parceiro recebe (${d.partner})`, csvMoney(sum.partner)],
    ['Vendedores recebem', csvMoney(sum.sellers)],
    ['Estética fica', csvMoney(sum.net)],
    [],
    ['OS', 'Data', 'Veículo', 'Placa', 'Serviços', 'Valor cobrado', 'Parceiro recebe', 'Vendedor', 'Vendedor recebe', 'Comissão do vendedor', 'Estética fica'],
    ...d.rows.map((r) => [r.number, brDate(r.date), r.vehicle, r.plate, describeServices(r, true), csvMoney(r.charged),
      csvMoney(r.partner_amount), r.seller ?? '—', csvMoney(r.seller_amount), sellerSource(r) ?? '—', csvMoney(r.net)]),
    [],
    ['Totais', '', '', '', '', csvMoney(d.totals.charged), csvMoney(d.totals.partner_amount), '', csvMoney(d.totals.seller_amount), '', csvMoney(d.totals.net)],
    [],
    ['Comissões por pessoa'],
    ['Pessoa', 'Função', 'OS', 'Total'],
    ...personTotals(d).map((p) => [p.name, p.role, p.orders, csvMoney(p.total)]),
  ];
  return '\uFEFF' + lines.map((l) => l.map(cell).join(';')).join('\r\n');
}

export function reportFileName(d: Pick<ReportData, 'partner' | 'from' | 'to'>, ext: 'pdf' | 'csv'): string {
  const slug = d.partner.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  return `relatorio-${slug}-${d.from}-a-${d.to}.${ext}`;
}