import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sessionCookieOptions, type CookieToSet } from './cookies';

/** Cliente Supabase para Server Components, Server Actions e Route Handlers (usa a sessão do usuário). */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list: CookieToSet[]) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, sessionCookieOptions(options)));
          } catch {
            // Chamado de um Server Component: o middleware cuida de renovar a sessão.
          }
        },
      },
    },
  );
}