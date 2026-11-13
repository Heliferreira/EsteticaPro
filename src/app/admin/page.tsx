import { createAdminClient } from '@/lib/supabase/admin';
import { setCompanySuspended } from '@/features/admin/actions';
import { NewClientForm } from '@/features/admin/components/NewClientForm';
import { ResetPasswordButton } from '@/features/admin/components/ResetPasswordButton';
import { fmtDate } from '@/lib/actions';

interface Row {
  id: string; name: string; created_at: string; suspended_at: string | null;
  memberships: Array<{ user_id: string; role: string }>;
}

export default async function AdminPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('companies')
    .select('id, name, created_at, suspended_at, memberships ( user_id, role )')
    .order('created_at', { ascending: false });
  const companies = (data ?? []) as Row[];

  // e-mail do dono de cada empresa
  const owners = new Map<string, string>();
  await Promise.all(companies.map(async (c) => {
    const owner = c.memberships.find((m) => m.role === 'owner');
    if (!owner) return;
    const { data: u } = await admin.auth.admin.getUserById(owner.user_id);
    if (u.user?.email) owners.set(c.id, u.user.email);
  }));

  return (
    <div className="space-y-6">
      <NewClientForm />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Empresas ({companies.length})</h2>
        {companies.length === 0 && <p className="card muted text-sm">Nenhuma empresa criada ainda.</p>}
        {companies.map((c) => {
          const owner = c.memberships.find((m) => m.role === 'owner');
          return (
            <div key={c.id} className="card flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{c.name} {c.suspended_at && <span className="badge badge-warn ml-2">Suspensa</span>}</p>
                <p className="muted text-sm">Dono: {owners.get(c.id) ?? '—'} · criada em {fmtDate(c.created_at)} · {c.memberships.length} usuário(s)</p>
              </div>
              <div className="flex flex-wrap items-start gap-3">
                {owner && <ResetPasswordButton userId={owner.user_id} />}
                <form action={setCompanySuspended}>
                  <input type="hidden" name="company_id" value={c.id} />
                  <input type="hidden" name="suspend" value={c.suspended_at ? 'false' : 'true'} />
                  <button className="btn-ghost">{c.suspended_at ? 'Reativar' : 'Suspender'}</button>
                </form>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
