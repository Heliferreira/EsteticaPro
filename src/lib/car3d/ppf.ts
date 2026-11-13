import type { BodyType } from '@/types/db';
import { CAR_SPECS } from './specs';

export interface PpfGroup { title: string; parts: Array<{ id: string; name: string }> }

/** Partes pintadas que podem receber PPF, agrupadas por região e adequadas ao tipo de carroceria. */
export function ppfGroups(type: BodyType): PpfGroup[] {
  const T = CAR_SPECS[type];
  const p = (id: string, name: string) => ({ id, name });
  const bed = T.rear === 'bed';
  return [
    { title: 'Frente', parts: [p('hood', 'Capô'), p('bumperF', 'Para-choque diant.'), p('fenderL', 'Paralama esq.'), p('fenderR', 'Paralama dir.'), p('headL', 'Farol esq.'), p('headR', 'Farol dir.')] },
    { title: 'Laterais', parts: T.doors === 2
      ? [p('doorL', 'Porta esq.'), p('doorR', 'Porta dir.'), p('mirrorL', 'Retrovisor esq.'), p('mirrorR', 'Retrovisor dir.'), p('quarterL', 'Lateral tras. esq.'), p('quarterR', 'Lateral tras. dir.')]
      : [p('doorFL', 'Porta diant. esq.'), p('doorFR', 'Porta diant. dir.'), p('doorRL', 'Porta tras. esq.'), p('doorRR', 'Porta tras. dir.'),
         p('mirrorL', 'Retrovisor esq.'), p('mirrorR', 'Retrovisor dir.'),
         p('quarterL', bed ? 'Caçamba lateral esq.' : 'Lateral tras. esq.'), p('quarterR', bed ? 'Caçamba lateral dir.' : 'Lateral tras. dir.')] },
    { title: 'Topo e traseira', parts: [p('roof', 'Teto'),
      bed ? p('tailgate', 'Tampa da caçamba') : p('trunk', T.rear === 'lid' ? 'Porta-malas' : 'Tampa traseira'),
      p('bumperR', 'Para-choque tras.'), p('tailL', 'Lanterna esq.'), p('tailR', 'Lanterna dir.')] },
  ];
}

export const ppfAllIds = (type: BodyType) => ppfGroups(type).flatMap((g) => g.parts.map((x) => x.id));
export const ppfPartName = (type: BodyType, id: string) =>
  ppfGroups(type).flatMap((g) => g.parts).find((x) => x.id === id)?.name ?? id;
