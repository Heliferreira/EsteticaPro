'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { login } from '@/features/auth/actions';
import { Field, FormError, SubmitButton } from '@/components/ui/form';

export default function LoginPage() {
  const [state, action] = useFormState(login, null);
  return (
    <form action={action} className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Entrar</h1>
      <FormError state={state} />
      <Field label="E-mail" name="email" state={state}>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} className="input" />
      </Field>
      <Field label="Senha" name="password" state={state}>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={72} className="input" />
      </Field>
      <SubmitButton pendingText="Entrando…" className="btn w-full">Entrar</SubmitButton>
      <p className="muted text-center text-sm">
        <Link href="/esqueci-senha" className="underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}
