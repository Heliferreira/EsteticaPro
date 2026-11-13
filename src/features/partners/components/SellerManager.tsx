'use client';

import { useRef } from 'react';
import { useFormState } from 'react-dom';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';
import { addSeller, deleteSeller } from '../actions';
import type { Seller } from '@/types/db';

export function SellerManager({ partnerId, sellers }: { partnerId: string; sellers: Seller[] }) {
  const [state, action] = useFormState(async (s: Parameters<typeof addSeller>[0], fd: FormData) => {
    const r = await addSeller(s, fd);
    if (r?.message) formRef.current?.reset();
    return r;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card mt-5 max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Vendedores do parceiro</h2>
        <p className="muted text-sm">Cada OS pode ter um vendedor. A comissão padrão é só sugestão: dá para ajustar em cada OS.</p>
      </div>
      {sellers.length === 0 ? <p className="muted text-sm">Nenhum vendedor cadastrado.</p> : (
        <ul className="divide-y text-sm" style={{ borderColor: 'var(--line)' }}>
          {sellers.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2" style={{ borderColor: 'var(--line)' }}>
              <span><b>{s.name}</b> <span className="muted">· comissão padrão {String(s.pct_default).replace('.', ',')}%</span></span>
              <form action={deleteSeller}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="partner_id" value={partnerId} />
                <button className="btn-danger">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form ref={formRef} action={action} className="grid items-end gap-3 md:grid-cols-[1fr_9rem_auto]">
        <input type="hidden" name="partner_id" value={partnerId} />
        <Field label="Nome" name="name" state={state}><input id="seller_name" name="name" required maxLength={120} className="input" /></Field>
        <Field label="Comissão padrão (%)" name="pct_default" state={state}><input id="seller_pct" name="pct_default" inputMode="decimal" className="input" placeholder="Ex.: 8" /></Field>
        <SubmitButton pendingText="Adicionando…">Adicionar</SubmitButton>
      </form>
      <FormError state={state} />
      <FormMessage state={state} />
    </div>
  );
}
