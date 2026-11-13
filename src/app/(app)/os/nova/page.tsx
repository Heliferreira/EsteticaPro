import { requireContext, canManage } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page';
import { NewOrderForm } from '@/features/orders/components/NewOrderForm';

export default async function NewOrderPage({ searchParams }: { searchParams: { cliente?: string } }) {
  const { supabase, role } = await requireContext();
  const manage = canManage(role);
  const [customers, vehicles, employees, partners, sellers] = await Promise.all([
    supabase.from('customers').select('id, name').order('name'),
    supabase.from('vehicles').select('id, customer_id, plate, model, brand').order('model'),
    supabase.from('employees').select('id, name').eq('active', true).order('name'),
    manage ? supabase.from('partners').select('id, name').order('name') : Promise.resolve({ data: null }),
    manage ? supabase.from('sellers').select('id, partner_id, name').order('name') : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <PageHeader title="Nova OS" subtitle="Escolha ou cadastre o cliente e o veículo aqui mesmo; a vistoria 3D abre na próxima tela." />
      <NewOrderForm customers={customers.data ?? []} vehicles={vehicles.data ?? []} employees={employees.data ?? []}
                    defaultCustomerId={searchParams.cliente}
                    partners={manage ? (partners.data ?? []) : undefined} sellers={manage ? (sellers.data ?? []) : undefined} />
    </>
  );
}