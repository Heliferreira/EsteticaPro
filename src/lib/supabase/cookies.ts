import type { CookieOptions } from '@supabase/ssr';

/**
 * Endurece os cookies de sessão: o app não usa cliente Supabase no navegador,
 * então o JavaScript da página nunca precisa ler o token (httpOnly protege contra XSS).
 */
export function sessionCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** Formato dos cookies que o @supabase/ssr entrega em setAll. */
export type CookieToSet = { name: string; value: string; options: CookieOptions };