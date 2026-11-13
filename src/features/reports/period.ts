export type Preset = 'today' | 'week' | 'lastweek' | 'fortnight' | 'month' | 'lastmonth' | 'custom';

export const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'lastweek', label: 'Semana passada' },
  { id: 'fortnight', label: 'Quinzena atual' },
  { id: 'month', label: 'Mês atual' },
  { id: 'lastmonth', label: 'Mês passado' },
  { id: 'custom', label: 'Período livre' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Data de hoje no fuso de Brasília (o servidor pode estar em UTC). */
export function todayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export const isYmd = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Intervalo [de, até] (YYYY-MM-DD) de cada atalho. Semana começa na segunda. */
export function presetRange(preset: Exclude<Preset, 'custom'>, today = todayYmd()): [string, string] {
  const [y, m, d] = today.split('-').map(Number);
  const t = utc(y, m - 1, d);
  switch (preset) {
    case 'today': return [toYmd(t), toYmd(t)];
    case 'week':
    case 'lastweek': {
      const dow = (t.getUTCDay() + 6) % 7;
      const start = utc(y, m - 1, d - dow - (preset === 'lastweek' ? 7 : 0));
      return [toYmd(start), toYmd(utc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6))];
    }
    case 'fortnight':
      return d <= 15 ? [toYmd(utc(y, m - 1, 1)), toYmd(utc(y, m - 1, 15))] : [toYmd(utc(y, m - 1, 16)), toYmd(utc(y, m, 0))];
    case 'lastmonth': return [toYmd(utc(y, m - 2, 1)), toYmd(utc(y, m - 1, 0))];
    case 'month': return [toYmd(utc(y, m - 1, 1)), toYmd(utc(y, m, 0))];
  }
}

export const brDate = (ymd: string) => ymd.split('-').reverse().join('/');
