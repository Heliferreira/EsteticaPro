import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireContext } from '@/lib/auth';
import { friendlyError, type FormState } from '@/lib/actions';

type Table = 'customers' | 'vehicles' | 'services' | 'employees' | 'partners' | 'products';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Insere (id = 'novo') ou atualiza um registro da empresa atual e volta para a lista. */
export async function persist(table: Table, id: string, values: Record<string, unknown>, listPath: string): Promise<FormState> {
  const { supabase, companyId } = await requireContext();
  if (id !== 'novo' && !UUID.test(id)) return { error: 'Registro inválido.' };
  const { error } = id === 'novo'
    ? await supabase.from(table).insert({ ...values, company_id: companyId })
    : await supabase.from(table).update(values).eq('id', id);
  if (error) return { error: friendlyError(error) };
  revalidatePath(listPath);
  redirect(listPath);
}

/** Remove um registro (formulário com campo oculto "id"). Em erro, volta à lista com ?erro=. */
export async function removeRow(table: Table, fd: FormData, listPath: string): Promise<void> {
  const { supabase } = await requireContext();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect(`${listPath}?erro=${encodeURIComponent('Registro inválido.')}`);
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);
  if (error) redirect(`${listPath}?erro=${encodeURIComponent(friendlyError(error))}`);
  if (!count) redirect(`${listPath}?erro=${encodeURIComponent('Sem permissão para excluir (apenas gerentes e donos).')}`);
  revalidatePath(listPath);
  redirect(listPath);
}