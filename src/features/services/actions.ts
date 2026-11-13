'use server';

import { parseForm, type FormState } from '@/lib/actions';
import { serviceSchema } from '@/lib/validation';
import { persist, removeRow } from '@/lib/crud';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendlyError } from '@/lib/actions';
import { serviceProductSchema } from '@/lib/validation';
import { requireContext, canManage } from '@/lib/auth';

export async function saveService(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { role } = await requireContext();
  if (!canManage(role)) return { error: 'Apenas gerentes e donos podem editar serviços.' };
  const p = parseForm(serviceSchema, fd);
  if (!p.ok) return p.state;
  return persist('services', id, p.data, '/servicos');
}
export async function deleteService(fd: FormData) {
  await removeRow('services', fd, '/servicos');
}

export async function addServiceProduct(serviceId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase, companyId, role } = await requireContext();
  if (!canManage(role)) return { error: 'Apenas gerentes e donos podem editar o consumo.' };
  const p = parseForm(serviceProductSchema, fd);
  if (!p.ok) return p.state;
  const { error } = await supabase.from('service_products').upsert(
    { company_id: companyId, service_id: serviceId, product_id: p.data.product_id, qty: p.data.qty },
    { onConflict: 'service_id,product_id' },
  );
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/servicos/${serviceId}`);
  return { message: 'Consumo salvo.' };
}

export async function removeServiceProduct(fd: FormData) {
  const { supabase } = await requireContext();
  const id = String(fd.get('id') ?? '');
  const serviceId = String(fd.get('service_id') ?? '');
  await supabase.from('service_products').delete().eq('id', id);
  revalidatePath(`/servicos/${serviceId}`);
  redirect(`/servicos/${serviceId}`);
}
