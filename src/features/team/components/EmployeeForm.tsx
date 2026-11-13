'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import type { FormState } from '@/lib/actions';
import type { Employee } from '@/types/db';

export function EmployeeForm({ action, employee }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; employee: Employee | null;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <FormError state={state} />
      <Field label="Nome" name="name" state={state}>
        <input id="name" name="name" defaultValue={employee?.name} required className="input" />
      </Field>
      <Field label="Função" name="role_title" state={state} hint="Ex.: Polidor, Lavador, Aplicador de película.">
        <input id="role_title" name="role_title" defaultValue={employee?.role_title ?? ''} className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={employee?.active ?? true} /> Ativo
      </label>
      <div className="flex gap-2">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/equipe" className="btn-ghost">Cancelar</Link>
      </div>
    </form>
  );
}
