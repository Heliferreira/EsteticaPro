'use client';

import { useFormState } from 'react-dom';
import { changePassword } from '@/features/auth/actions';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';

export function ChangePasswordForm() {
  const [state, action] = useFormState(changePassword, null);
  return (
    <form action={action} className="card max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Trocar senha</h2>
      <FormError state={state} />
      <FormMessage state={state} />
      <Field label="Senha atual" name="current" state={state}>
        <input id="current" name="current" type="password" autoComplete="current-password" required maxLength={72} className="input" />
      </Field>
      <Field label="Nova senha" name="password" state={state} hint="10+ caracteres, com letras e números.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className="input" />
      </Field>
      <Field label="Repita a nova senha" name="confirm" state={state}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={72} className="input" />
      </Field>
      <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}
