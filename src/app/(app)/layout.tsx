import { requireContext, canManage } from '@/lib/auth';
import { logout } from '@/features/auth/actions';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const { data: profile } = await ctx.supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
  const fullName = (profile?.full_name as string | null) || ctx.email.split('@')[0];
  const first = fullName.trim().split(/\s+/)[0] || 'você';

  return (
    <div className="min-h-screen md:p-6">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 p-4 md:min-h-[calc(100vh-3rem)] md:flex-row md:rounded-[32px] md:p-6"
           style={{ background: 'var(--shell)' }}>
        <Sidebar initial={first.charAt(0).toUpperCase()} logout={logout} canManage={canManage(ctx.role)} />
        <main className="min-w-0 flex-1">
          <Header name={first} company={ctx.companyName} />
          {children}
        </main>
      </div>
    </div>
  );
}
