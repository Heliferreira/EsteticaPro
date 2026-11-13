'use server';

import { parseForm, type FormState } from '@/lib/actions';
import { customerSchema } from '@/lib/validation';
import { persist, removeRow } from '@/lib/crud';

export async function saveCustomer(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(customerSchema, fd);
  if (!p.ok) return p.state;
  return persist('customers', id, p.data, '/clientes');
}
export async function deleteCustomer(fd: FormData) {
  await removeRow('customers', fd, '/clientes');
}
