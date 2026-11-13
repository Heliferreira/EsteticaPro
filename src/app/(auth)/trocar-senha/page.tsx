'use client';

import { useFormState } from 'react-dom';
import { changePassword, logout } from '@/features/auth/actions';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';

/** Primeiro acesso: a senha temporária enviada pelo suporte precisa ser trocada antes de entrar. */
export default function ForcedPasswordPage() {
  const [state, action] = useFormState(changePassword, null);
  return (
    <>
      <form action={action} className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Crie sua senha</h1>
        <p className="muted text-sm">Por segurança, troque a senha temporária por uma só sua (10+ caracteres, com letras e números).</p>
        <FormError state={state} />
        <FormMessage state={state} />
        <Field label="Senha temporária" name="current" state={state}>
          <input id="current" name="current" type="password" autoComplete="current-password" required maxLength={72} className="input" />
        </Field>
        <Field label="Nova senha" name="password" state={state}>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className="input" />
        </Field>
        <Field label="Repita a nova senha" name="confirm" state={state}>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required maxLength={72} className="input" />
        </Field>
        <SubmitButton pendingText="Salvando…" className="btn w-full">Salvar e entrar</SubmitButton>
      </form>
      <form action={logout} className="mt-4 text-center"><button className="muted text-sm underline">Sair</button></form>
    </>
  );
}
