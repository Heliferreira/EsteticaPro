import { requireContext } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page';
import { ChangePasswordForm } from '@/features/account/components/ChangePasswordForm';

const ROLE_LABEL = { owner: 'Dono', manager: 'Gerente', operator: 'Operador' } as const;

export default async function AccountPage() {
  const { email, role, companyName } = await requireContext();
  return (
    <>
      <PageHeader title="Minha conta" subtitle={`${email} · ${ROLE_LABEL[role]} em ${companyName}`} />
      <ChangePasswordForm />
    </>
  );
}
