import { ppfPartName } from '@/lib/car3d/ppf';
import type { BodyType, ReportData, ReportRow } from '@/types/db';
import { brDate } from './period';

const EXTRA_PARTS: Record<string, string> = {
  windshield: 'Para-brisa', rearglass: 'Vidro traseiro', grille: 'Grade frontal', bedFloor: 'Caçamba (piso)',
};

export function partLabel(type: BodyType, id: string): string {
  const n = ppfPartName(type, id);
  return n !== id ? n : EXTRA_PARTS[id] ?? id;
}

/** Texto dos serviços da OS para a coluna do relatório. */
export function describeServices(row: ReportRow): string {
  const parts: string[] = [];
  row.marks.forEach((m) => { if (m.service) parts.push(`${m.service} (${partLabel(row.body_type, m.part)})`); });
  row.items.forEach((i) => {
    if (i.ppf) {
      parts.push(i.ppf.mode === 'full' ? 'PPF Full (carro completo)'
        : `PPF: ${i.ppf.parts.map((p) => partLabel(row.body_type, p.id)).join(', ')}`);
    } else {
      parts.push(i.description);
    }
  });
  return parts.join('; ') || '—';
}

export const BRL_FMT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** Moeda sem o espaço não separável (NBSP), que o PDF padrão não desenha bem. */
export const money = (n: number) => BRL_FMT.format(n).replace(/[  ]/g, ' ');
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
  return [{ name: d.partner, role: 'Parceiro', orders: d.totals.orders, total: Number(d.totals.partner_amount) }, ...sellers.values()];
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV pronto para o Excel em português: separador ";", vírgula decimal e BOM UTF-8 (acentos). */
export function buildCsv(d: ReportData): string {
  const lines: Array<Array<string | number>> = [
    ['Relatório de serviços em parceria'],
    ['Parceiro', d.partner],
    ['Período', periodLabel(d)],
    [],
    ['OS', 'Data', 'Veículo', 'Placa', 'Serviços', 'Valor cobrado', 'Comissão parceiro', 'Vendedor', 'Comissão vendedor', 'Líquido estética'],
    ...d.rows.map((r) => [r.number, brDate(r.date), r.vehicle, r.plate, describeServices(r), csvMoney(r.charged),
      csvMoney(r.partner_amount), r.seller ?? '—', csvMoney(r.seller_amount), csvMoney(r.net)]),
    [],
    ['Totais', '', '', '', '', csvMoney(d.totals.charged), csvMoney(d.totals.partner_amount), '', csvMoney(d.totals.seller_amount), csvMoney(d.totals.net)],
    [],
    ['Comissões por pessoa'],
    ['Pessoa', 'Função', 'OS', 'Total'],
    ...personTotals(d).map((p) => [p.name, p.role, p.orders, csvMoney(p.total)]),
  ];
  return '﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n');
}

export function reportFileName(d: Pick<ReportData, 'partner' | 'from' | 'to'>, ext: 'pdf' | 'csv'): string {
  const slug = d.partner.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  return `relatorio-${slug}-${d.from}-a-${d.to}.${ext}`;
}
