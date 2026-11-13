'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { friendlyError, parseForm, type FormState } from '@/lib/actions';
import { persist, removeRow } from '@/lib/crud';
import { requireContext, canManage } from '@/lib/auth';
import { uuid } from '@/lib/validation';
import { partnerSchema, sellerSchema } from './schemas';

async function manager() {
  const ctx = await requireContext();
  if (!canManage(ctx.role)) redirect('/dashboard');
  return ctx;
}

export async function savePartner(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await manager();
  const p = parseForm(partnerSchema, fd);
  if (!p.ok) return p.state;
  return persist('partners', id, p.data, '/parceiros');
}

export async function deletePartner(fd: FormData) {
  await manager();
  await removeRow('partners', fd, '/parceiros');
}

export async function addSeller(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, companyId } = await manager();
  const p = parseForm(sellerSchema, fd);
  if (!p.ok) return p.state;
  const { error } = await supabase.from('sellers').insert({ ...p.data, company_id: companyId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/parceiros/${p.data.partner_id}`);
  return { message: 'Vendedor adicionado.' };
}

export async function deleteSeller(fd: FormData): Promise<void> {
  const { supabase } = await manager();
  const id = uuid.safeParse(fd.get('id'));
  const partnerId = uuid.safeParse(fd.get('partner_id'));
  if (!id.success || !partnerId.success) return;
  const { error } = await supabase.from('sellers').delete().eq('id', id.data);
  const back = `/parceiros/${partnerId.data}`;
  if (error) redirect(`${back}?erro=${encodeURIComponent(error.code === '23503' ? 'Este vendedor tem OS registradas e não pode ser removido.' : friendlyError(error))}`);
  revalidatePath(back);
  redirect(back);
}
