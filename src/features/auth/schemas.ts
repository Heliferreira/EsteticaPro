import { z } from 'zod';
import { newPassword } from '@/lib/security/password';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
  password: z.string().min(1, 'Informe a senha.').max(72),
});

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
});

const same = (d: { password: string; confirm: string }) => d.password === d.confirm;
const sameMsg = { message: 'As senhas não conferem.', path: ['confirm'] };

export const resetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine(same, sameMsg);

export const changePasswordSchema = z
  .object({ current: z.string().min(1, 'Informe a senha atual.').max(72), password: newPassword, confirm: z.string() })
  .refine(same, sameMsg);
