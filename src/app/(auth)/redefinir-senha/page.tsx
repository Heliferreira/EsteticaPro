'use client';

import { useFormState } from 'react-dom';
import { resetPassword } from '@/features/auth/actions';
import { Field, FormError, SubmitButton } from '@/components/ui/form';

export default function ResetPasswordPage() {
  const [state, action] = useFormState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Criar nova senha</h1>
      <p className="muted text-sm">Use ao menos 10 caracteres, misturando letras e números.</p>
      <FormError state={state} />
      <Field label="Nova senha" name="password" state={state}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className="input" />
      </Field>
      <Field label="Repita a nova senha" name="confirm" state={state}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={72} className="input" />
      </Field>
      <SubmitButton pendingText="Salvando…" className="btn w-full">Salvar senha</SubmitButton>
    </form>
  );
}
