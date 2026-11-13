import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/types/db';

export interface AppContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  email: string;
  companyId: string;
  companyName: string;
  role: Role;
}

/** Garante usuário logado e com empresa ativa. Use no topo de páginas e actions protegidas. */
export async function requireContext(): Promise<AppContext> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (user.app_metadata?.must_change_password === true) redirect('/trocar-senha');

  const { data } = await supabase
    .from('memberships')
    .select('company_id, role, companies ( name )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Sem empresa ativa (ou empresa suspensa, que o RLS esconde): admin vai ao painel, os demais à tela de aviso.
  if (!data) redirect(user.app_metadata?.platform_admin === true ? '/admin' : '/sem-acesso');
  const company = data.companies as unknown as { name: string } | null;

  return {
    supabase,
    userId: user.id,
    email: user.email ?? '',
    companyId: data.company_id as string,
    companyName: company?.name ?? '',
    role: data.role as Role,
  };
}

/** Só o admin geral (você). Para qualquer outra pessoa a página "não existe" (404). */
export async function requirePlatformAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (user.app_metadata?.platform_admin !== true) notFound();
  return { userId: user.id, email: user.email ?? '' };
}

export const canManage = (role: Role) => role === 'owner' || role === 'manager';
