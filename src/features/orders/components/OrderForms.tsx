'use client';

import { useFormState } from 'react-dom';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';
import { OS_STATUS_LABEL, OS_STATUS_ORDER } from '@/lib/os-status';
import type { FormState } from '@/lib/actions';
import type { OsStatus } from '@/types/db';

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

export function OrderDetailsForm({ action, status, employeeId, notes, employees }: {
  action: Action; status: OsStatus; employeeId: string | null; notes: string | null;
  employees: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card grid gap-4 md:grid-cols-[200px_240px_1fr_auto] md:items-end">
      <Field label="Status" name="status" state={state}>
        <select id="status" name="status" className="input" defaultValue={status}>
          {OS_STATUS_ORDER.map((s) => <option key={s} value={s}>{OS_STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Responsável" name="employee_id" state={state}>
        <select id="employee_id" name="employee_id" className="input" defaultValue={employeeId ?? ''}>
          <option value="">Sem responsável</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <Field label="Observações" name="notes" state={state}>
        <input id="notes" name="notes" className="input" defaultValue={notes ?? ''} />
      </Field>
      <SubmitButton>Salvar</SubmitButton>
      <div className="md:col-span-4"><FormError state={state} /><FormMessage state={state} /></div>
    </form>
  );
}

export function AddItemForm({ action, services }: {
  action: Action; services: Array<{ id: string; name: string; default_price: number }>;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} key={state?.message ?? 'form'} className="mt-3 grid gap-3 md:grid-cols-[200px_1fr_140px_auto] md:items-end">
      <Field label="Serviço (opcional)" name="service_id" state={state}>
        <select id="service_id" name="service_id" className="input" defaultValue="">
          <option value="">—</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Descrição" name="description" state={state}>
        <input id="description" name="description" className="input" required placeholder="Ex.: Higienização interna" />
      </Field>
      <Field label="Preço (R$)" name="price" state={state}>
        <input id="price" name="price" className="input" inputMode="decimal" placeholder="0,00" />
      </Field>
      <SubmitButton pendingText="Adicionando…">Adicionar</SubmitButton>
      <div className="md:col-span-4"><FormError state={state} /></div>
    </form>
  );
}