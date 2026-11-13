'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import type { FormState } from '@/lib/actions';
import type { Service } from '@/types/db';

export function ServiceForm({ action, service }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; service: Service | null;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <FormError state={state} />
      <Field label="Nome do serviço" name="name" state={state}>
        <input id="name" name="name" defaultValue={service?.name} required className="input" />
      </Field>
      <Field label="Tipo de serviço" name="kind" state={state} hint="PPF abre a escolha entre Full e as partes do veículo dentro da OS.">
        <select id="kind" name="kind" className="input" defaultValue={service?.kind ?? 'standard'}>
          <option value="standard">Padrão (aplicado em uma peça)</option>
          <option value="ppf">PPF (Full ou por partes)</option>
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preço padrão / PPF Full (R$)" name="default_price" state={state}>
          <input id="default_price" name="default_price" inputMode="decimal" defaultValue={service ? String(service.default_price).replace('.', ',') : ''} className="input" placeholder="0,00" />
        </Field>
        <Field label="Preço por parte, só PPF (R$)" name="part_price" state={state} hint="Valor sugerido para cada parte; dá para ajustar na OS.">
          <input id="part_price" name="part_price" inputMode="decimal" defaultValue={service ? String(service.part_price).replace('.', ',') : ''} className="input" placeholder="0,00" />
        </Field>
        <Field label="Tempo estimado (min)" name="est_minutes" state={state}>
          <input id="est_minutes" name="est_minutes" inputMode="numeric" defaultValue={service?.est_minutes ?? ''} className="input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={service?.active ?? true} /> Serviço ativo (aparece nas OS)
      </label>
      <div className="flex gap-2">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/servicos" className="btn-ghost">Cancelar</Link>
      </div>
    </form>
  );
}
