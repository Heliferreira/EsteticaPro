import { notFound, redirect } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page';
import { saveEmployee } from '@/features/team/actions';
import { EmployeeForm } from '@/features/team/components/EmployeeForm';
import type { Employee } from '@/types/db';

export default async function EmployeePage({ params }: { params: { id: string } }) {
  const { supabase, role } = await requireContext();
  if (!canManage(role)) redirect('/equipe');
  let employee: Employee | null = null;
  if (params.id !== 'novo') {
    const { data } = await supabase.from('employees').select('*').eq('id', params.id).maybeSingle();
    if (!data) notFound();
    employee = data as Employee;
  }
  return (
    <>
      <PageHeader title={employee ? 'Editar funcionário' : 'Novo funcionário'} />
      <EmployeeForm action={saveEmployee.bind(null, params.id)} employee={employee} />
    </>
  );
}
