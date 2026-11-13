import { z } from 'zod';
import { randomInt } from 'node:crypto';

/** Regra para criar/trocar senha: 10+ caracteres, com letra e número. (O login não repete a regra.) */
export const newPassword = z
  .string()
  .min(10, 'Use ao menos 10 caracteres.')
  .max(72, 'Use no máximo 72 caracteres.')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Misture letras e números.');

/** Senha temporária legível (sem caracteres que se confundem como 0/O e 1/l). */
export function generateTempPassword(length = 14): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(letters), pick(digits)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
