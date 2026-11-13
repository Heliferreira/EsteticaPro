'use client';

import { useFormState } from 'react-dom';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';
import type { FormState } from '@/lib/actions';

export function ConsumptionForm({ action, products }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  products: Array<{ id: string; name: string; unit: string }>;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} key={state?.message ?? 'c'} className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      <Field label="Produto" name="product_id" state={state}>
        <select id="product_id" name="product_id" className="input" required defaultValue="">
          <option value="" disabled>Selecione…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
        </select>
      </Field>
      <Field label="Qtd. por aplicação" name="qty" state={state}>
        <input id="qty" name="qty" inputMode="decimal" required className="input" placeholder="Ex.: 30" />
      </Field>
      <SubmitButton pendingText="Salvando…">Adicionar</SubmitButton>
      <div className="sm:col-span-3"><FormError state={state} /><FormMessage state={state} /></div>
    </form>
  );
}
