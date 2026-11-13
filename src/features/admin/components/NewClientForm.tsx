'use client';

import { useFormState } from 'react-dom';
import { createClientCompany } from '../actions';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';

export function NewClientForm() {
  const [state, action] = useFormState(createClientCompany, null);
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-semibold">Nova empresa cliente</h2>
      <FormError state={state} />
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Nome da empresa" name="company_name" state={state}>
          <input id="company_name" name="company_name" required maxLength={120} className="input" />
        </Field>
        <Field label="Nome do dono" name="owner_name" state={state}>
          <input id="owner_name" name="owner_name" required maxLength={120} className="input" />
        </Field>
        <Field label="E-mail do dono (será o login)" name="owner_email" state={state}>
          <input id="owner_email" name="owner_email" type="email" required maxLength={254} className="input" />
        </Field>
      </div>
      <SubmitButton pendingText="Criando…">Criar empresa e acesso</SubmitButton>
    </form>
  );
}
