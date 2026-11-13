import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieOptions, type CookieToSet } from './cookies';

/** Páginas abertas a quem não está logado. Não existe cadastro público: contas são criadas pelo admin. */
const PUBLIC_PATHS = ['/login', '/esqueci-senha', '/auth/callback'];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + '/'));

/** Renova a sessão e protege as rotas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list: CookieToSet[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options)));
        },
      },
    },
  );

  // getUser() valida o token no servidor do Supabase (getSession() só leria o cookie).
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const go = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = '';
    return NextResponse.redirect(url);
  };

  if (!user) return matches(path, PUBLIC_PATHS) ? response : go('/login');

  const meta = (user.app_metadata ?? {}) as { must_change_password?: boolean; platform_admin?: boolean };

  // Senha temporária: só pode usar a tela de troca (e sair).
  if (meta.must_change_password === true && path !== '/trocar-senha') return go('/trocar-senha');

  if (matches(path, ['/login', '/esqueci-senha'])) return go(meta.platform_admin ? '/admin' : '/dashboard');
  return response;
}