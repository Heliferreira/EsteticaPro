'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { friendlyError, parseForm, type FormState } from '@/lib/actions';
import { changePasswordSchema, emailSchema, loginSchema, resetPasswordSchema } from './schemas';

type Meta = { must_change_password?: boolean; platform_admin?: boolean };

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(loginSchema, fd);
  if (!p.ok) return p.state;
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(p.data);
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (error || !data.user) return { error: 'E-mail ou senha incorretos.' };
  const meta = (data.user.app_metadata ?? {}) as Meta;
  if (meta.must_change_password) redirect('/trocar-senha');
  redirect(meta.platform_admin ? '/admin' : '/dashboard');
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/** Esqueci minha senha. Resposta sempre igual, exista o e-mail ou não. */
export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(emailSchema, fd);
  if (!p.ok) return p.state;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || headers().get('origin') || '';
  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(p.data.email, {
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });
  return { message: 'Se esse e-mail estiver cadastrado, enviamos um link para criar uma nova senha.' };
}

/** Nova senha depois do link do e-mail (a sessão veio do /auth/callback). */
export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(resetPasswordSchema, fd);
  if (!p.ok) return p.state;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'O link expirou. Peça um novo em "Esqueci minha senha".' };
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return { error: friendlyError(error) };
  await clearMustChange(user.id, user.app_metadata as Meta);
  redirect('/dashboard');
}

/** Troca de senha logado (tela Conta e troca obrigatória da senha temporária): confere a senha atual. */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(changePasswordSchema, fd);
  if (!p.ok) return p.state;
  if (p.data.current === p.data.password) return { error: 'A nova senha precisa ser diferente da atual.' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login');
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: p.data.current });
  if (check.error) return { fieldErrors: { current: 'Senha atual incorreta.' }, error: 'Confira os campos destacados.' };
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return { error: friendlyError(error) };
  const wasForced = (user.app_metadata as Meta)?.must_change_password === true;
  await clearMustChange(user.id, user.app_metadata as Meta);
  if (wasForced) redirect('/dashboard');
  return { message: 'Senha alterada com sucesso.' };
}

/** Só o servidor (service_role) consegue editar app_metadata: o usuário não consegue se "liberar" sozinho. */
async function clearMustChange(userId: string, meta: Meta | undefined) {
  if (meta?.must_change_password !== true) return;
  await createAdminClient().auth.admin.updateUserById(userId, { app_metadata: { must_change_password: false } });
}
