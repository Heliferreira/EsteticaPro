import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page';
import { saveVehicle } from '@/features/vehicles/actions';
import { VehicleForm } from '@/features/vehicles/components/VehicleForm';
import type { Vehicle } from '@/types/db';

export default async function VehiclePage({ params, searchParams }: {
  params: { id: string }; searchParams: { cliente?: string };
}) {
  const { supabase } = await requireContext();
  let vehicle: Vehicle | null = null;
  if (params.id !== 'novo') {
    const { data } = await supabase.from('vehicles').select('*').eq('id', params.id).maybeSingle();
    if (!data) notFound();
    vehicle = data as Vehicle;
  }
  const { data: customers } = await supabase.from('customers').select('id, name').order('name');
  return (
    <>
      <PageHeader title={vehicle ? 'Editar veículo' : 'Novo veículo'} />
      <VehicleForm action={saveVehicle.bind(null, params.id)} vehicle={vehicle}
                   customers={customers ?? []} defaultCustomerId={searchParams.cliente} />
    </>
  );
}
