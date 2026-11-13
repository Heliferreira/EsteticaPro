import type { CommissionMode } from '@/types/db';

/** Mesma regra do banco (commission_amount): % sobre o valor cobrado, ou valor fixo. */
export function commissionAmount(mode: CommissionMode, value: number | null, base: number): number {
  if (value == null || Number.isNaN(value)) return 0;
  return mode === 'pct' ? Math.round(base * value) / 100 : value;
}

/** "1.234,56" / "80,5" / "80" → número. Vazio → null. Inválido → NaN. */
export function parseAmount(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}
