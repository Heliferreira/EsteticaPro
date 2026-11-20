import { jsPDF } from 'jspdf';

/**
 * Dados da "ficha do funcionário". De propósito NÃO existe nenhum campo de preço,
 * total, parceiro, vendedor ou comissão aqui: o que não chega ao PDF não pode vazar.
 */
export interface OsSheet {
  number: number;
  entryAt: string;
  status: string;
  employee: string | null;
  customer: string;
  phone: string | null;
  vehicle: string;
  plate: string;
  color: string | null;
  bodyType: string;
  tasks: Array<{ group: 'Vistoria 3D' | 'PPF' | 'Itens avulsos'; title: string; detail: string | null; note: string | null }>;
  notes: string | null;
}

const M = 40;          // margem
const W = 595.28;      // largura A4 (pt)
const H = 841.89;      // altura A4 (pt)
const LINE = 14;

export function buildOsPdf(d: OsSheet): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  let y = 48;

  const ensure = (need: number) => {
    if (y + need > H - 60) { doc.addPage(); y = 48; }
  };
  const text = (t: string, x: number, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).text(t, x, y);
  };
  const wrap = (t: string, width: number, size = 10) => {
    doc.setFont('helvetica', 'normal').setFontSize(size);
    return doc.splitTextToSize(t, width) as string[];
  };

  // Cabeçalho
  text(`Ordem de serviço #${d.number}`, M, 20, true);
  const date = new Date(d.entryAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(`Entrada: ${date}`, W - M, y - 10, { align: 'right' });
  doc.text(`Status: ${d.status}`, W - M, y + 4, { align: 'right' });
  y += 22;
  doc.setDrawColor(180).line(M, y, W - M, y);
  y += 20;

  // Cliente e veículo
  const info: Array<[string, string]> = [
    ['Cliente', d.customer + (d.phone ? `  ·  ${d.phone}` : '')],
    ['Veículo', `${d.vehicle}  ·  Placa ${d.plate}`],
    ['Detalhes', [d.color ? `Cor ${d.color}` : null, `Carroceria ${d.bodyType}`].filter(Boolean).join('  ·  ')],
    ['Responsável', d.employee ?? 'A definir'],
  ];
  info.forEach(([k, v]) => {
    text(`${k}:`, M, 10, true);
    const lines = wrap(v, W - M * 2 - 80);
    lines.forEach((l, i) => { doc.setFont('helvetica', 'normal').setFontSize(10).text(l, M + 80, y + i * LINE); });
    y += LINE * Math.max(1, lines.length) + 2;
  });
  y += 10;

  // Serviços a executar
  text('Serviços a executar', M, 13, true);
  y += 8;
  doc.setDrawColor(180).line(M, y, W - M, y);
  y += 16;

  if (d.tasks.length === 0) {
    text('Nenhum serviço registrado nesta OS.', M, 10);
    y += 20;
  }
  let group = '';
  d.tasks.forEach((t) => {
    if (t.group !== group) {
      ensure(30);
      group = t.group;
      text(t.group.toUpperCase(), M, 9, true);
      y += 14;
    }
    const titleLines = wrap(t.title + (t.detail ? ` — ${t.detail}` : ''), W - M * 2 - 24);
    const noteLines = t.note ? wrap(`Obs.: ${t.note}`, W - M * 2 - 24, 9) : [];
    ensure(LINE * (titleLines.length + noteLines.length) + 10);
    doc.setDrawColor(60).setLineWidth(0.8).rect(M, y - 9, 10, 10);   // caixinha para marcar
    titleLines.forEach((l, i) => { doc.setFont('helvetica', 'normal').setFontSize(10).text(l, M + 22, y + i * LINE); });
    y += LINE * titleLines.length;
    noteLines.forEach((l) => { doc.setFont('helvetica', 'italic').setFontSize(9).text(l, M + 22, y); y += 12; });
    y += 6;
  });

  // Observações da OS
  if (d.notes) {
    y += 8;
    ensure(40);
    text('Observações', M, 12, true);
    y += 16;
    wrap(d.notes, W - M * 2).forEach((l) => { ensure(LINE); doc.setFont('helvetica', 'normal').setFontSize(10).text(l, M, y); y += LINE; });
  }

  // Anotações do funcionário
  y += 18;
  ensure(150);
  text('Anotações do funcionário', M, 12, true);
  y += 10;
  for (let i = 0; i < 5; i++) { y += 22; doc.setDrawColor(200).setLineWidth(0.5).line(M, y, W - M, y); }

  // Assinatura
  y += 40;
  ensure(40);
  doc.setDrawColor(120).line(M, y, M + 230, y);
  doc.line(M + 270, y, M + 390, y);
  y += 12;
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100);
  doc.text('Executado por (assinatura)', M, y);
  doc.text('Data', M + 270, y);
  doc.setTextColor(0);

  return doc.output('arraybuffer');
}