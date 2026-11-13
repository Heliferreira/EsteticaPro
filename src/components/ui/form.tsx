'use client';

import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/actions';

export function SubmitButton({ children, pendingText = 'Salvando…', className = 'btn' }: {
  children: React.ReactNode; pendingText?: string; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="mb-3 rounded-2xl px-4 py-3 text-sm"
       style={{ background: 'color-mix(in srgb, var(--danger) 16%, transparent)', color: 'var(--danger)' }}>
      {state.error}
    </p>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return <p role="status" className="mb-3 text-sm" style={{ color: 'var(--ok)' }}>{state.message}</p>;
}

export function Field({ label, name, state, children, hint }: {
  label: string; name: string; state?: FormState; children: React.ReactNode; hint?: string;
}) {
  const err = state?.fieldErrors?.[name];
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {hint && !err && <p className="mt-1 text-xs muted">{hint}</p>}
      {err && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{err}</p>}
    </div>
  );
}
