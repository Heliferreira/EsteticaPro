import { logout } from '@/features/auth/actions';

export default function NoAccessPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Sem acesso no momento</h1>
      <p className="muted mt-3 text-sm">
        Sua conta não está ligada a uma empresa ativa. Se você acha que isso é um engano, fale com o suporte.
      </p>
      <form action={logout} className="mt-5"><button className="btn w-full">Sair</button></form>
    </>
  );
}
