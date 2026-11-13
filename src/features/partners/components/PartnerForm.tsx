'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import type { FormState } from '@/lib/actions';
import type { Partner } from '@/types/db';

export function PartnerForm({ action, partner }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; partner: Partner | null;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <FormError state={state} />
      <Field label="Nome do parceiro" name="name" state={state}>
        <input id="name" name="name" defaultValue={partner?.name} required maxLength={120} className="input" />
      </Field>
      <Field label="Comissão padrão do parceiro (%)" name="pct_default" state={state}
             hint="Só uma sugestão ao abrir OS desse parceiro. Pode ser 0 e dá para ajustar em cada OS.">
        <input id="pct_default" name="pct_default" inputMode="decimal" defaultValue={partner ? String(partner.pct_default).replace('.', ',') : ''} className="input" />
      </Field>
      <Field label="Observações" name="notes" state={state}>
        <textarea id="notes" name="notes" rows={2} defaultValue={partner?.notes ?? ''} maxLength={500} className="input" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/parceiros" className="btn-ghost">Cancelar</Link>
      </div>
    </form>
  );
}
