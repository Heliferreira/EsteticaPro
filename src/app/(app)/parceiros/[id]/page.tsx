import { notFound, redirect } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { PageHeader, ErrorBanner } from '@/components/ui/page';
import { savePartner } from '@/features/partners/actions';
import { PartnerForm } from '@/features/partners/components/PartnerForm';
import { SellerManager } from '@/features/partners/components/SellerManager';
import type { Partner, Seller } from '@/types/db';

export default async function PartnerPage({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string } }) {
  const { supabase, role } = await requireContext();
  if (!canManage(role)) redirect('/dashboard');
  let partner: Partner | null = null;
  let sellers: Seller[] = [];
  if (params.id !== 'novo') {
    const [p, s] = await Promise.all([
      supabase.from('partners').select('*').eq('id', params.id).maybeSingle(),
      supabase.from('sellers').select('*').eq('partner_id', params.id).order('name'),
    ]);
    if (!p.data) notFound();
    partner = p.data as Partner;
    sellers = (s.data ?? []) as Seller[];
  }
  return (
    <>
      <PageHeader title={partner ? 'Editar parceiro' : 'Novo parceiro'} />
      <ErrorBanner message={searchParams.erro} />
      <PartnerForm action={savePartner.bind(null, params.id)} partner={partner} />
      {partner && <SellerManager partnerId={partner.id} sellers={sellers} />}
    </>
  );
}
