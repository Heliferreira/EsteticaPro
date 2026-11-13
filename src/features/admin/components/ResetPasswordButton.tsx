'use client';

import { useFormState } from 'react-dom';
import { resetOwnerPassword } from '../actions';
import { FormError, FormMessage, SubmitButton } from '@/components/ui/form';

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action] = useFormState(resetOwnerPassword, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton pendingText="Gerando…" className="btn-ghost">Gerar nova senha</SubmitButton>
      <FormError state={state} />
      <FormMessage state={state} />
    </form>
  );
}
