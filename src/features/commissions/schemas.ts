import { z } from 'zod';
import { optUuid } from '@/lib/validation';

/** Valor opcional ("" vira null). Aceita "1.234,56" ou "80,5". */
export const optAmount = z.preprocess((v) => {
  if (typeof v !== 'string') return v ?? null;
  const s = v.trim();
  if (s === '') return null;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
}, z.number({ invalid_type_error: 'Valor inválido.' }).min(0, 'Não pode ser negativo.').max(9_999_999).nullable());

const mode = z.enum(['pct', 'val']);

export const commissionSchema = z
  .object({
    partner_id: optUuid,
    seller_id: optUuid,
    charged: optAmount,
    partner_mode: mode,
    partner_value: optAmount,
    seller_mode: mode,
    seller_value: optAmount,
  })
  .superRefine((d, ctx) => {
    if (d.partner_mode === 'pct' && d.partner_value != null && d.partner_value > 100)
      ctx.addIssue({ code: 'custom', path: ['partner_value'], message: 'Percentual não pode passar de 100%. Para valor fixo, use R$.' });
    if (d.seller_mode === 'pct' && d.seller_value != null && d.seller_value > 100)
      ctx.addIssue({ code: 'custom', path: ['seller_value'], message: 'Percentual não pode passar de 100%. Para valor fixo, use R$.' });
    if (d.seller_id && !d.partner_id)
      ctx.addIssue({ code: 'custom', path: ['seller_id'], message: 'Escolha o parceiro do vendedor.' });
  });
