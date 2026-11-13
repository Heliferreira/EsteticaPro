import { requirePlatformAdmin } from '@/lib/auth';
import { logout } from '@/features/auth/actions';

export const metadata = { title: 'Admin · Vistoria 3D' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-bold tracking-tight">Administração</p>
          <p className="muted text-sm">{admin.email}</p>
        </div>
        <form action={logout}><button className="btn-ghost">Sair</button></form>
      </header>
      {children}
    </main>
  );
}
