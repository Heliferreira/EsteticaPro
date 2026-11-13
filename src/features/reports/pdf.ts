import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportData } from '@/types/db';
import { brDate } from './period';
import { describeServices, money, periodLabel, personTotals } from './format';

/** PDF A4 paisagem do relatório (gerado no servidor). */
export function buildPdf(d: ReportData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const M = 36;
  let y = 44;
  doc.setFont('helvetica', 'bold').setFontSize(16).text('Relatório de serviços em parceria', M, y);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  y += 18; doc.text(`Parceiro: ${d.partner}`, M, y);
  y += 14; doc.text(`Período: ${periodLabel(d)}   ·   ${d.totals.orders} OS`, M, y);

  autoTable(doc, {
    startY: y + 14,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [43, 43, 45] },
    footStyles: { fillColor: [230, 230, 230], textColor: 20 },
    columnStyles: { 3: { cellWidth: 200 } },
    head: [['OS', 'Data', 'Veículo', 'Serviços', 'Cobrado', 'Com. parceiro', 'Vendedor', 'Com. vendedor', 'Líquido']],
    body: d.rows.map((r) => [`#${r.number}`, brDate(r.date), `${r.vehicle} · ${r.plate}`, describeServices(r), money(r.charged),
      money(r.partner_amount), r.seller ?? '—', money(r.seller_amount), money(r.net)]),
    foot: [['Totais', '', '', '', money(d.totals.charged), money(d.totals.partner_amount), '', money(d.totals.seller_amount), money(d.totals.net)]],
  });

  const last = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let fy = last + 22;
  if (fy > 520) { doc.addPage(); fy = 50; }
  doc.setFont('helvetica', 'bold').setFontSize(11).text('Comissões por pessoa', M, fy);
  autoTable(doc, {
    startY: fy + 8,
    margin: { left: M, right: M },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [43, 43, 45] },
    head: [['Pessoa', 'Função', 'OS', 'Total']],
    body: personTotals(d).map((p) => [p.name, p.role, String(p.orders), money(p.total)]),
  });
  doc.setFont('helvetica', 'normal').setFontSize(8)
    .text(`Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · Valor total a repassar à estética: ${money(d.totals.charged)}`, M, 570);
  return doc.output('arraybuffer');
}
