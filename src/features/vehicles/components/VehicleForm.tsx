'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import { BODY_TYPE_ORDER, bodyTypeLabel } from '@/lib/car3d/specs';
import { PAINT_PRESETS } from '@/lib/car3d/marks';
import type { FormState } from '@/lib/actions';
import type { Vehicle } from '@/types/db';

export function VehicleForm({ action, vehicle, customers, defaultCustomerId }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  vehicle: Vehicle | null;
  customers: Array<{ id: string; name: string }>;
  defaultCustomerId?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <FormError state={state} />
      <Field label="Cliente" name="customer_id" state={state}>
        <select id="customer_id" name="customer_id" required className="input"
                defaultValue={vehicle?.customer_id ?? defaultCustomerId ?? ''}>
          <option value="" disabled>Selecione…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Placa" name="plate" state={state}>
          <input id="plate" name="plate" defaultValue={vehicle?.plate} required maxLength={8} className="input font-mono uppercase" placeholder="ABC1D23" />
        </Field>
        <Field label="Tipo de carroceria (modelo 3D)" name="body_type" state={state}>
          <select id="body_type" name="body_type" className="input" defaultValue={vehicle?.body_type ?? 'sedan'}>
            {BODY_TYPE_ORDER.map((t) => <option key={t} value={t}>{bodyTypeLabel(t)}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marca" name="brand" state={state}>
          <input id="brand" name="brand" defaultValue={vehicle?.brand ?? ''} className="input" />
        </Field>
        <Field label="Modelo" name="model" state={state}>
          <input id="model" name="model" defaultValue={vehicle?.model} required className="input" />
        </Field>
        <Field label="Ano" name="year" state={state}>
          <input id="year" name="year" inputMode="numeric" defaultValue={vehicle?.year ?? ''} className="input" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cor (nome)" name="color" state={state}>
          <input id="color" name="color" defaultValue={vehicle?.color ?? ''} className="input" placeholder="Ex.: Vermelho" />
        </Field>
        <Field label="Cor no 3D" name="color_hex" state={state}>
          <input id="color_hex" name="color_hex" type="color" defaultValue={vehicle?.color_hex ?? PAINT_PRESETS[4].hex} className="h-10 w-full cursor-pointer rounded-md border p-1" style={{ borderColor: 'var(--line)' }} />
        </Field>
      </div>
      <Field label="Observações" name="notes" state={state}>
        <textarea id="notes" name="notes" rows={2} defaultValue={vehicle?.notes ?? ''} className="input" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/veiculos" className="btn-ghost">Cancelar</Link>
      </div>
    </form>
  );
}
