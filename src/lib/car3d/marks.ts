import type { MarkStatus } from '@/types/db';

export interface MarkStatusInfo {
  id: MarkStatus;
  label: string;
  /** Cor usada para pintar a peça no 3D (null = sem tinta) */
  color: string | null;
}

export const MARK_STATUS: MarkStatusInfo[] = [
  { id: 'ok',       label: 'Sem ocorrência',    color: null },
  { id: 'risco',    label: 'Riscos leves',      color: '#e6b800' },
  { id: 'riscoP',   label: 'Riscos profundos',  color: '#f08a24' },
  { id: 'amassado', label: 'Amassado',          color: '#e5484d' },
  { id: 'mancha',   label: 'Mancha / oxidação', color: '#9b5de5' },
  { id: 'trinca',   label: 'Trinca / quebra',   color: '#d6409f' },
];

/** Cor usada no 3D para as partes que receberam PPF (não é uma ocorrência da vistoria). */
export const PPF_TINT = '#3fb6c9';

export function markStatusInfo(id: string): { id: string; label: string; color: string | null } {
  if (id === 'ppf') return { id: 'ppf', label: 'PPF', color: PPF_TINT };
  return MARK_STATUS.find((s) => s.id === id) ?? MARK_STATUS[0];
}

export const PAINT_PRESETS: Array<{ name: string; hex: string }> = [
  { name: 'Branco',   hex: '#eef0f2' },
  { name: 'Prata',    hex: '#b7bcc4' },
  { name: 'Grafite',  hex: '#4b5159' },
  { name: 'Preto',    hex: '#15171b' },
  { name: 'Vermelho', hex: '#b3121c' },
  { name: 'Azul',     hex: '#1d4fa8' },
  { name: 'Verde',    hex: '#1f5a3e' },
  { name: 'Amarelo',  hex: '#e0a800' },
];
