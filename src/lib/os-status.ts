import type { OsStatus } from '@/types/db';

export const OS_STATUS_LABEL: Record<OsStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  done: 'Concluída',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};
export const OS_STATUS_ORDER: OsStatus[] = ['open', 'in_progress', 'done', 'delivered', 'cancelled'];
