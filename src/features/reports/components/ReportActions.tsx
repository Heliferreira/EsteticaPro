'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Botões de baixar PDF/Excel (+ opção de congelar as OS do período). */
export function ReportActions({ partner, from, to, pendingToFreeze }: {
  partner: string; from: string; to: string; pendingToFreeze: number;
}) {
  const router = useRouter();
  const [freeze, setFreeze] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function download(format: 'pdf' | 'csv') {
    setBusy(format); setMsg(null);
    try {
      const res = await fetch('/relatorios/arquivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, partner, from, to, freeze: freeze && pendingToFreeze > 0 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setMsg({ ok: false, text: j?.error ?? 'Não foi possível gerar o arquivo.' });
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get('X-Filename') ?? `relatorio.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setMsg({ ok: true, text: freeze && pendingToFreeze > 0 ? `Arquivo gerado e ${pendingToFreeze} OS congeladas.` : 'Arquivo gerado.' });
      if (freeze) { setFreeze(false); router.refresh(); }
    } catch {
      setMsg({ ok: false, text: 'Falha de conexão. Tente novamente.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card mt-4 space-y-4">
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} disabled={pendingToFreeze === 0} />
        <span>
          <b>Congelar as OS deste período ao baixar</b><br />
          <span className="muted">
            As OS ficam travadas (valores, serviços e comissões) para o relatório enviado não mudar depois. Dá para reabrir quando precisar.
            {pendingToFreeze === 0 ? ' Todas as OS deste período já estão congeladas.' : ` ${pendingToFreeze} OS ainda não congeladas.`}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => download('pdf')} disabled={busy !== null}>{busy === 'pdf' ? 'Gerando…' : 'Baixar PDF'}</button>
        <button className="btn-ghost" onClick={() => download('csv')} disabled={busy !== null}>{busy === 'csv' ? 'Gerando…' : 'Baixar Excel (CSV)'}</button>
        {msg && <span role="status" className="text-sm" style={{ color: msg.ok ? 'var(--ok)' : 'var(--danger)' }}>{msg.text}</span>}
      </div>
    </div>
  );
}
