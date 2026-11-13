'use client';

import { useState } from 'react';

/** Baixa de novo um relatório já congelado (usa o retrato salvo, que nunca muda). */
export function ReportDownload({ reportId }: { reportId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function go(format: 'pdf' | 'csv') {
    setBusy(format);
    try {
      const res = await fetch('/relatorios/arquivo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, report: reportId }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get('X-Filename') ?? `relatorio.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally { setBusy(null); }
  }
  return (
    <>
      <button className="btn-ghost !px-3.5 !py-1.5 !text-xs" onClick={() => go('pdf')} disabled={busy !== null}>PDF</button>{' '}
      <button className="btn-ghost !px-3.5 !py-1.5 !text-xs" onClick={() => go('csv')} disabled={busy !== null}>Excel</button>
    </>
  );
}
