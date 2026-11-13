'use server';

import { revalidatePath } from 'next/cache';
import { requireContext, canManage } from '@/lib/auth';
import { friendlyError, parseForm, type FormState } from '@/lib/actions';
import { movementSchema, productSchema } from '@/lib/validation';
import { persist, removeRow } from '@/lib/crud';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveProduct(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { role } = await requireContext();
  if (!canManage(role)) return { error: 'Apenas gerentes e donos podem editar produtos.' };
  const p = parseForm(productSchema, fd);
  if (!p.ok) return p.state;
  return persist('products', id, p.data, '/estoque');
}

export async function deleteProduct(fd: FormData) {
  await removeRow('products', fd, '/estoque');
}

/** Registra entrada, saída ou ajuste. O sinal da quantidade é definido pelo tipo. */
export async function addMovement(productId: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!UUID.test(productId)) return { error: 'Produto inválido.' };
  const p = parseForm(movementSchema, fd);
  if (!p.ok) return p.state;
  const { supabase, companyId } = await requireContext();
  const abs = Math.abs(p.data.qty);
  const qty = p.data.kind === 'in' ? abs : p.data.kind === 'out' ? -abs : p.data.qty;
  const { error } = await supabase.from('stock_movements').insert({
    company_id: companyId, product_id: productId, kind: p.data.kind, qty, note: p.data.note,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/estoque/${productId}`);
  revalidatePath('/estoque');
  return { message: 'Movimentação registrada.' };
}
