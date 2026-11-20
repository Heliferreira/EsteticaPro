'use client';

import { createContext, useContext, useState } from 'react';
import type { MarkRow } from './InspectionWorkspace';

type Marks = Record<string, MarkRow>;
interface Live { marks: Marks; setMarks: React.Dispatch<React.SetStateAction<Marks>> }

const Ctx = createContext<Live | null>(null);

/**
 * Guarda as marcações da vistoria 3D num lugar só. Assim a vistoria (que edita)
 * e o resumo/total no fim da OS (que lê) mostram sempre os mesmos números, ao vivo.
 */
export function OrderLive({ initialMarks, children }: { initialMarks: MarkRow[]; children: React.ReactNode }) {
  const [marks, setMarks] = useState<Marks>(() => Object.fromEntries(initialMarks.map((m) => [m.part_id, m])));
  return <Ctx.Provider value={{ marks, setMarks }}>{children}</Ctx.Provider>;
}

export function useOrderMarks(): Live {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOrderMarks precisa estar dentro de <OrderLive>.');
  return v;
}