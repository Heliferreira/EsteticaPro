'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';
import { UNITS, UNIT_LABEL } from '@/lib/stock';
import type { FormState } from '@/lib/actions';
import type { ProductStockRow } from '@/types/db';

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

export function ProductForm({ action, product, canEdit }: { action: Action; product: ProductStockRow | null; canEdit: boolean }) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <FormError state={state} />
      <Field label="Nome do produto" name="name" state={state}>
        <input id="name" name="name" defaultValue={product?.name} required disabled={!canEdit} className="input" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código (opcional)" name="sku" state={state}>
          <input id="sku" name="sku" defaultValue={product?.sku ?? ''} disabled={!canEdit} className="input" />
        </Field>
        <Field label="Unidade" name="unit" state={state}>
          <select id="unit" name="unit" defaultValue={product?.unit ?? 'un'} disabled={!canEdit} className="input">
            {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
        </Field>
        <Field label="Estoque mínimo" name="min_stock" state={state} hint="Abaixo disso o produto aparece como baixo.">
          <input id="min_stock" name="min_stock" inputMode="decimal" defaultValue={product ? String(product.min_stock).replace('.', ',') : '0'} disabled={!canEdit} className="input" />
        </Field>
        <Field label="Custo por unidade (R$)" name="cost" state={state}>
          <input id="cost" name="cost" inputMode="decimal" defaultValue={product ? String(product.cost).replace('.', ',') : ''} disabled={!canEdit} className="input" placeholder="0,00" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} disabled={!canEdit} /> Produto ativo
      </label>
      {canEdit && (
        <div className="flex gap-2">
          <SubmitButton>Salvar</SubmitButton>
          <Link href="/estoque" className="btn-ghost">Cancelar</Link>
        </div>
      )}
    </form>
  );
}

export function MovementForm({ action, unit }: { action: Action; unit: string }) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} key={state?.message ?? 'm'} className="card mt-4 max-w-xl space-y-4">
      <h2 className="font-display text-xl font-bold">Registrar movimentação</h2>
      <FormError state={state} /><FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field label="Tipo" name="kind" state={state}>
          <select id="kind" name="kind" className="input" defaultValue="in">
            <option value="in">Entrada (compra)</option>
            <option value="out">Saída (uso/perda)</option>
            <option value="adjust">Ajuste (+/−)</option>
          </select>
        </Field>
        <Field label={`Quantidade (${unit})`} name="qty" state={state} hint="No ajuste use negativo para reduzir.">
          <input id="qty" name="qty" inputMode="decimal" required className="input" />
        </Field>
      </div>
      <Field label="Observação" name="note" state={state}>
        <input id="note" name="note" className="input" maxLength={200} placeholder="Ex.: compra no fornecedor X" />
      </Field>
      <SubmitButton pendingText="Registrando…">Registrar</SubmitButton>
    </form>
  );
}
