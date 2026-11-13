'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { friendlyError, parseForm, type FormState } from '@/lib/actions';
import { generateTempPassword } from '@/lib/security/password';
import { newClientSchema, uuidSchema } from './schemas';

/** Cria o usuário dono (senha temporária, troca obrigatória) e a empresa com os serviços iniciais. */
export async function createClientCompany(_: FormState, fd: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const p = parseForm(newClientSchema, fd);
  if (!p.ok) return p.state;

  const admin = createAdminClient();
  const temp = generateTempPassword();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: p.data.owner_email,
    password: temp,
    email_confirm: true,
    user_metadata: { full_name: p.data.owner_name },
    app_metadata: { must_change_password: true },
  });
  if (userErr || !created.user) {
    return { error: userErr?.message.includes('already') ? 'Já existe um usuário com esse e-mail.' : 'Não foi possível criar o usuário.' };
  }

  const { error: companyErr } = await admin.rpc('admin_create_company', {
    p_name: p.data.company_name,
    p_owner: created.user.id,
  });
  if (companyErr) {
    await admin.auth.admin.deleteUser(created.user.id); // não deixa usuário órfão
    return { error: friendlyError(companyErr) };
  }

  revalidatePath('/admin');
  return {
    message: `Empresa criada. Entregue ao dono: e-mail ${p.data.owner_email} · senha temporária ${temp} (aparece só agora; no primeiro acesso ele cria a própria senha).`,
  };
}

/** Gera nova senha temporária para o dono (esqueceu a senha e não tem acesso ao e-mail, por exemplo). */
export async function resetOwnerPassword(_: FormState, fd: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const id = uuidSchema.safeParse(fd.get('user_id'));
  if (!id.success) return { error: 'Usuário inválido.' };
  const temp = generateTempPassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(id.data, {
    password: temp,
    app_metadata: { must_change_password: true },
  });
  if (error) return { error: 'Não foi possível redefinir a senha.' };
  return { message: `Nova senha temporária: ${temp} (aparece só agora).` };
}

/** Suspende ou reativa uma empresa: enquanto suspensa, ninguém dela enxerga dados. */
export async function setCompanySuspended(fd: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = uuidSchema.safeParse(fd.get('company_id'));
  if (!id.success) return;
  const suspend = fd.get('suspend') === 'true';
  await createAdminClient().from('companies').update({ suspended_at: suspend ? new Date().toISOString() : null }).eq('id', id.data);
  revalidatePath('/admin');
}
