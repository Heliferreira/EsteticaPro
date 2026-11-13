'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireContext, canManage } from '@/lib/auth';
import { friendlyError } from '@/lib/actions';
import { uuid } from '@/lib/validation';

/** Reabre um período congelado: as OS voltam a ser editáveis e o relatório congelado é apagado. */
export async function reopenReport(fd: FormData): Promise<void> {
  const { supabase, role } = await requireContext();
  if (!canManage(role)) redirect('/dashboard');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) redirect('/relatorios');
  const { error } = await supabase.rpc('reopen_report', { p_report: id.data });
  if (error) redirect(`/relatorios?erro=${encodeURIComponent(friendlyError(error))}`);
  revalidatePath('/relatorios');
  redirect('/relatorios');
}
