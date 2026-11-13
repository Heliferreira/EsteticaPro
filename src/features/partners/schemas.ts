import { z } from 'zod';
import { optText, reqText, uuid } from '@/lib/validation';

/** Percentual de 0 a 100, aceita vírgula. Vazio vira 0. */
export const percent = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  return s === '' ? 0 : Number(s.replace(',', '.'));
}, z.number({ invalid_type_error: 'Percentual inválido.' }).min(0, 'Use de 0 a 100.').max(100, 'Use de 0 a 100.'));

export const partnerSchema = z.object({
  name: reqText(2, 120, 'Informe o nome do parceiro.'),
  pct_default: percent,
  notes: optText(500),
});

export const sellerSchema = z.object({
  partner_id: uuid,
  name: reqText(2, 120, 'Informe o nome do vendedor.'),
  pct_default: percent,
});
