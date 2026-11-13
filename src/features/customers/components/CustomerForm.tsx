'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import type { FormState } from '@/lib/actions';
import type { Customer } from '@/types/db';

export function CustomerForm({ action, customer }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; customer: Customer | null;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <FormError state={state} />
      <Field label="Nome" name="name" state={state}>
        <input id="name" name="name" defaultValue={customer?.name} required className="input" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone / WhatsApp" name="phone" state={state}>
          <input id="phone" name="phone" defaultValue={customer?.phone ?? ''} inputMode="tel" className="input" />
        </Field>
        <Field label="E-mail" name="email" state={state}>
          <input id="email" name="email" type="email" defaultValue={customer?.email ?? ''} className="input" />
        </Field>
      </div>
      <Field label="CPF / CNPJ" name="document" state={state}>
        <input id="document" name="document" defaultValue={customer?.document ?? ''} className="input" />
      </Field>
      <Field label="Observações" name="notes" state={state}>
        <textarea id="notes" name="notes" rows={3} defaultValue={customer?.notes ?? ''} className="input" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/clientes" className="btn-ghost">Cancelar</Link>
      </div>
    </form>
  );
}
