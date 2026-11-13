import type { MovementKind, Unit } from '@/types/db';

export const UNIT_LABEL: Record<Unit, string> = { un: 'un', ml: 'ml', l: 'L', g: 'g', kg: 'kg' };
export const UNITS: Unit[] = ['un', 'ml', 'l', 'g', 'kg'];
export const KIND_LABEL: Record<MovementKind, string> = {
  in: 'Entrada', out: 'Saída', adjust: 'Ajuste', os: 'Baixa de OS',
};

export const fmtQty = (n: number, unit: Unit) =>
  `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${UNIT_LABEL[unit]}`;
