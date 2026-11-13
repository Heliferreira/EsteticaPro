import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page';
import { saveCustomer } from '@/features/customers/actions';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import type { Customer } from '@/types/db';

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireContext();
  let customer: Customer | null = null;
  if (params.id !== 'novo') {
    const { data } = await supabase.from('customers').select('*').eq('id', params.id).maybeSingle();
    if (!data) notFound();
    customer = data as Customer;
  }
  return (
    <>
      <PageHeader title={customer ? 'Editar cliente' : 'Novo cliente'} />
      <CustomerForm action={saveCustomer.bind(null, params.id)} customer={customer} />
    </>
  );
}
