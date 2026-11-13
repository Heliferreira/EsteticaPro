'use server';

import { parseForm, type FormState } from '@/lib/actions';
import { vehicleSchema } from '@/lib/validation';
import { persist, removeRow } from '@/lib/crud';

export async function saveVehicle(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(vehicleSchema, fd);
  if (!p.ok) return p.state;
  return persist('vehicles', id, p.data, '/veiculos');
}
export async function deleteVehicle(fd: FormData) {
  await removeRow('vehicles', fd, '/veiculos');
}
