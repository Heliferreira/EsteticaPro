'use server';

import { parseForm, type FormState } from '@/lib/actions';
import { employeeSchema } from '@/lib/validation';
import { persist, removeRow } from '@/lib/crud';
import { requireContext, canManage } from '@/lib/auth';

export async function saveEmployee(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { role } = await requireContext();
  if (!canManage(role)) return { error: 'Apenas gerentes e donos podem editar a equipe.' };
  const p = parseForm(employeeSchema, fd);
  if (!p.ok) return p.state;
  return persist('employees', id, p.data, '/equipe');
}
export async function deleteEmployee(fd: FormData) {
  await removeRow('employees', fd, '/equipe');
}
