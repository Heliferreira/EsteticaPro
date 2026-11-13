'use server';

import { revalidatePath } from 'next/cache';
import { requireContext, canManage } from '@/lib/auth';
import { friendlyError, parseForm, type FormState } from '@/lib/actions';
import { uuid } from '@/lib/validation';
import { commissionSchema } from './schemas';

/** Salva origem (parceiro/vendedor), valor cobrado e comissões da OS. Sem parceiro = remove a linha. */
export async function saveCommission(osId: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!uuid.safeParse(osId).success) return { error: 'OS inválida.' };
  const { supabase, companyId, role } = await requireContext();
  if (!canManage(role)) return { error: 'Apenas gerentes e donos podem editar comissões.' };
  const p = parseForm(commissionSchema, fd);
  if (!p.ok) return p.state;

  if (!p.data.partner_id) {
    const { error } = await supabase.from('work_order_commissions').delete().eq('work_order_id', osId);
    if (error) return { error: friendlyError(error) };
    revalidatePath(`/os/${osId}`);
    return { message: 'Origem e comissões removidas. A OS segue normalmente como venda direta.' };
  }

  const { error } = await supabase.from('work_order_commissions').upsert({
    work_order_id: osId,
    company_id: companyId,
    partner_id: p.data.partner_id,
    seller_id: p.data.seller_id,
    charged: p.data.charged,
    partner_mode: p.data.partner_mode,
    partner_value: p.data.partner_value,
    seller_mode: p.data.seller_mode,
    seller_value: p.data.seller_value,
  }, { onConflict: 'work_order_id' });
  if (error) {
    return { error: error.code === '23503' ? 'O vendedor escolhido não pertence a esse parceiro.' : friendlyError(error) };
  }
  revalidatePath(`/os/${osId}`);
  revalidatePath('/relatorios');
  return { message: 'Origem e comissões salvas.' };
}
