'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { requestPasswordReset } from '@/features/auth/actions';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';

export default function ForgotPasswordPage() {
  const [state, action] = useFormState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Esqueci minha senha</h1>
      <p className="muted text-sm">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <FormError state={state} />
      <FormMessage state={state} />
      <Field label="E-mail" name="email" state={state}>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
      </Field>
      <SubmitButton pendingText="Enviando…" className="btn w-full">Enviar link</SubmitButton>
      <p className="muted text-center text-sm"><Link href="/login" className="underline">Voltar ao login</Link></p>
    </form>
  );
}
