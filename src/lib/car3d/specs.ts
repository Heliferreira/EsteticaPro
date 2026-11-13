import type { BodyType } from '@/types/db';

/** Medidas em metros. x = frente do carro, y = altura, z = lado direito. */
export interface CarSpec {
  label: string;
  L: number; W: number; wb: number; R: number;
  belt: number; roofY: number;
  xRF: number; xRR: number;
  R2: [number, number];
  xC: number; xMid: number; drEnd: number;
  hoodDrop: number;
  doors: 2 | 4;
  rear: 'lid' | 'hatch' | 'bed';
  glassFrac: number;
  rails?: boolean;
}

export const CAR_SPECS: Record<BodyType, CarSpec> = {
  sedan:  { label: 'Sedã',   L: 4.70, W: 1.82, wb: 2.80, R: .34, belt: .95,  roofY: 1.44, xRF: .25, xRR: -.80,  R2: [-1.20, .98],   xC: -1.15, xMid: 0,   drEnd: -.94,  hoodDrop: .17, doors: 4, rear: 'lid',   glassFrac: 1 },
  hatch:  { label: 'Hatch',  L: 4.05, W: 1.76, wb: 2.55, R: .32, belt: .92,  roofY: 1.46, xRF: .15, xRR: -1.00, R2: [-1.945, .94],  xC: -1.50, xMid: 0,   drEnd: -.835, hoodDrop: .15, doors: 4, rear: 'hatch', glassFrac: .6 },
  wagon:  { label: 'Perua',  L: 4.75, W: 1.82, wb: 2.78, R: .34, belt: .96,  roofY: 1.50, xRF: .22, xRR: -2.00, R2: [-2.295, .98],  xC: -2.15, xMid: 0,   drEnd: -.93,  hoodDrop: .17, doors: 4, rear: 'hatch', glassFrac: .65, rails: true },
  suv:    { label: 'SUV',    L: 4.60, W: 1.86, wb: 2.72, R: .38, belt: 1.08, roofY: 1.68, xRF: .30, xRR: -1.35, R2: [-2.22, 1.10],  xC: -1.60, xMid: 0,   drEnd: -.86,  hoodDrop: .14, doors: 4, rear: 'hatch', glassFrac: .6,  rails: true },
  pickup: { label: 'Picape', L: 5.30, W: 1.95, wb: 3.20, R: .40, belt: 1.08, roofY: 1.82, xRF: .55, xRR: -.70,  R2: [-.82, 1.08],   xC: -.82,  xMid: .12, drEnd: -.80,  hoodDrop: .18, doors: 4, rear: 'bed',   glassFrac: 1 },
  coupe:  { label: 'Cupê',   L: 4.55, W: 1.84, wb: 2.70, R: .34, belt: .90,  roofY: 1.30, xRF: .30, xRR: -.55,  R2: [-1.25, .95],   xC: -1.20, xMid: 0,   drEnd: -.45,  hoodDrop: .20, doors: 2, rear: 'lid',   glassFrac: 1 },
};

export const BODY_TYPE_ORDER: BodyType[] = ['sedan', 'hatch', 'wagon', 'suv', 'pickup', 'coupe'];

export function bodyTypeLabel(t: BodyType): string {
  return CAR_SPECS[t].label;
}
