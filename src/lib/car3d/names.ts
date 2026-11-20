import type { BodyType } from '@/types/db';
import { ppfPartName } from './ppf';

const EXTRA: Record<string, string> = {
  windshield: 'Para-brisa',
  rearglass: 'Vidro traseiro',
  grille: 'Grade frontal',
  bedFloor: 'Caçamba (piso)',
};

const SIDE: Record<string, string> = { L: 'esq.', R: 'dir.' };

/**
 * Nome legível de qualquer peça da vistoria 3D, sem precisar do three.js
 * (por isso funciona no servidor: PDF da OS, relatórios e resumo da tela).
 */
export function partName(type: BodyType, id: string): string {
  const painted = ppfPartName(type, id);
  if (painted !== id) return painted;
  if (EXTRA[id]) return EXTRA[id];

  // Rodas: wheel + F/R (frente/trás) + L/R (esquerda/direita)
  const wheel = /^wheel([FR])([LR])$/.exec(id);
  if (wheel) return `Roda ${wheel[1] === 'F' ? 'diant.' : 'tras.'} ${SIDE[wheel[2]]}`;

  // Vidros laterais: win + S (cupê), F, R ou Q + L/R
  const win = /^win([SFRQ])([LR])$/.exec(id);
  if (win) {
    const base = win[1] === 'S' ? 'Vidro' : win[1] === 'F' ? 'Vidro diant.' : win[1] === 'R' ? 'Vidro tras.' : 'Vidro lateral tras.';
    return `${base} ${SIDE[win[2]]}`;
  }

  return id; // peça desconhecida: mostra o próprio código
}