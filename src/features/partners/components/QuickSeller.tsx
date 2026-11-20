'use client';

import { useState, useTransition } from 'react';
import { createSellerInline } from '../actions';
import type { Seller } from '@/types/db';

/**
 * Cadastro rápido de vendedor dentro de outro formulário (Nova OS, Origem e comissões).
 * Não usa <form> (não pode haver formulário dentro de formulário) e os campos não têm "name",
 * então nada daqui vai junto no envio da OS: o vendedor é salvo na hora, pelo botão.
 */
export function QuickSeller({ partnerId, onCreated }: { partnerId: string; onCreated: (seller: Seller) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pct, setPct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await createSellerInline({ partner_id: partnerId, name, pct_default: pct });
      if (res.error || !res.seller) { setError(res.error ?? 'Não foi possível cadastrar o vendedor.'); return; }
      onCreated(res.seller);
      setName(''); setPct(''); setOpen(false);
    });
  }

  // Enter dentro destes campos salva o vendedor, em vez de enviar a OS inteira.
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!pending) save();
  };

  if (!open) {
    return <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setOpen(true)}>+ Cadastrar novo vendedor</button>;
  }

  return (
    <div className="space-y-3 rounded-2xl p-4" style={{ background: 'var(--surface)' }}>
      <p className="text-sm font-medium">Novo vendedor</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div>
          <label className="label" htmlFor="quick_seller_name">Nome</label>
          <input id="quick_seller_name" className="input" maxLength={120} autoFocus value={name}
                 onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} />
        </div>
        <div>
          <label className="label" htmlFor="quick_seller_pct">Comissão padrão (%)</label>
          <input id="quick_seller_pct" className="input" inputMode="decimal" placeholder="Ex.: 5" value={pct}
                 onChange={(e) => setPct(e.target.value)} onKeyDown={onEnter} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn !px-4 !py-2" disabled={pending} onClick={save}>{pending ? 'Salvando…' : 'Salvar vendedor'}</button>
        <button type="button" className="btn-ghost !px-4 !py-2" disabled={pending} onClick={() => { setOpen(false); setError(null); }}>Cancelar</button>
      </div>
    </div>
  );
}