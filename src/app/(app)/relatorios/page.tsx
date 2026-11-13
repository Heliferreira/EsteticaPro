import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireContext, canManage } from '@/lib/auth';
import { PageHeader, ErrorBanner, Empty } from '@/components/ui/page';
import { ReportActions } from '@/features/reports/components/ReportActions';
import { ReportDownload } from '@/features/reports/components/ReportDownload';
import { ReopenButton } from '@/features/reports/components/ReopenButton';
import { describeServices, money, periodLabel, personTotals } from '@/features/reports/format';
import { PRESETS, brDate, isYmd, presetRange, todayYmd, type Preset } from '@/features/reports/period';
import { fmtDate } from '@/lib/actions';
import type { CommissionReport, Partner, ReportData } from '@/types/db';

interface Params { parceiro?: string; periodo?: string; de?: string; ate?: string; erro?: string }

export default async function ReportsPage({ searchParams }: { searchParams: Params }) {
  const { supabase, role } = await requireContext();
  if (!canManage(role)) redirect('/dashboard');

  const [partnersQ, reportsQ] = await Promise.all([
    supabase.from('partners').select('*').order('name'),
    supabase.from('commission_reports').select('*').order('number', { ascending: false }).limit(50),
  ]);
  const partners = (partnersQ.data ?? []) as Partner[];
  const reports = (reportsQ.data ?? []) as CommissionReport[];

  if (partners.length === 0) {
    return (
      <>
        <PageHeader title="Relatórios" />
        <Empty>Cadastre um parceiro em <Link className="underline" href="/parceiros/novo">Parceiros</Link> para gerar relatórios.</Empty>
      </>
    );
  }

  const partner = partners.find((p) => p.id === searchParams.parceiro) ?? partners[0];
  const preset: Preset = PRESETS.some((p) => p.id === searchParams.periodo) ? (searchParams.periodo as Preset) : 'week';
  let from: string, to: string;
  if (preset === 'custom') {
    const [mf, mt] = presetRange('month');
    from = isYmd(searchParams.de) ? searchParams.de : mf;
    to = isYmd(searchParams.ate) ? searchParams.ate : mt;
  } else {
    [from, to] = presetRange(preset, todayYmd());
  }

  let data: ReportData | null = null;
  let loadError = searchParams.erro;
  if (to < from) {
    loadError = 'A data final precisa ser igual ou depois da inicial.';
  } else {
    const { data: r, error } = await supabase.rpc('commission_report', { p_partner: partner.id, p_from: from, p_to: to });
    if (error) loadError = error.message; else data = r as ReportData;
  }
  const pending = data ? data.rows.filter((r) => !r.frozen).length : 0;
  const href = (o: Partial<Params>) => {
    const q = new URLSearchParams({ parceiro: partner.id, periodo: preset, ...(preset === 'custom' ? { de: from, ate: to } : {}), ...o } as Record<string, string>);
    return `/relatorios?${q.toString()}`;
  };

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Serviços feitos em parceria, valores cobrados e comissões de cada pessoa, para o período que você escolher." />
      <ErrorBanner message={loadError} />

      <div className="card space-y-4">
        <form className="grid items-end gap-4 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="periodo" value={preset} />
          {preset === 'custom' && <><input type="hidden" name="de" value={from} /><input type="hidden" name="ate" value={to} /></>}
          <div>
            <label className="label" htmlFor="parceiro">Parceiro</label>
            <select id="parceiro" name="parceiro" defaultValue={partner.id} className="input">
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn-ghost">Trocar parceiro</button>
        </form>
        <div>
          <p className="label">Período</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Link key={p.id} href={href({ periodo: p.id, ...(p.id === 'custom' ? { de: from, ate: to } : {}) })}
                    aria-current={preset === p.id ? 'true' : undefined}
                    className={preset === p.id ? 'btn !px-4 !py-2' : 'btn-ghost !px-4 !py-2'}>{p.label}</Link>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <form className="grid max-w-md grid-cols-2 items-end gap-3">
            <input type="hidden" name="parceiro" value={partner.id} /><input type="hidden" name="periodo" value="custom" />
            <div><label className="label" htmlFor="de">De</label><input id="de" type="date" name="de" defaultValue={from} className="input" /></div>
            <div><label className="label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" defaultValue={to} className="input" /></div>
            <button className="btn-ghost col-span-2">Aplicar datas</button>
          </form>
        )}
      </div>

      {data && (
        <>
          <div className="card mt-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{data.partner}</h2>
                <p className="muted text-sm">{periodLabel(data)} · {data.totals.orders} OS concluídas · data considerada: conclusão da OS</p>
              </div>
              <div className="text-right">
                <p className="muted text-xs">Total a repassar à estética</p>
                <p className="font-display text-3xl font-bold">{money(Number(data.totals.charged))}</p>
              </div>
            </div>
            {data.rows.length === 0 ? (
              <p className="muted text-sm">Nenhuma OS concluída deste parceiro no período.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl" style={{ background: 'var(--surface-2)' }}>
                  <table className="w-full min-w-[860px]">
                    <thead><tr>
                      {['OS', 'Data', 'Veículo', 'Serviços', 'Cobrado', 'Com. parceiro', 'Vendedor', 'Com. vendedor', 'Líquido'].map((h) => <th key={h} className="th">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.order_id} className="row">
                          <td className="td"><Link className="underline" href={`/os/${r.order_id}`}>#{r.number}</Link>{r.frozen && <span className="badge ml-2">congelada</span>}</td>
                          <td className="td">{brDate(r.date)}</td>
                          <td className="td">{r.vehicle} · <span className="font-mono">{r.plate}</span></td>
                          <td className="td max-w-[260px]">{describeServices(r)}</td>
                          <td className="td">{money(Number(r.charged))}</td>
                          <td className="td">{money(Number(r.partner_amount))}</td>
                          <td className="td">{r.seller ?? '—'}</td>
                          <td className="td">{money(Number(r.seller_amount))}</td>
                          <td className="td">{money(Number(r.net))}</td>
                        </tr>
                      ))}
                      <tr className="row font-semibold">
                        <td className="td" colSpan={4}>Totais</td>
                        <td className="td">{money(Number(data.totals.charged))}</td>
                        <td className="td">{money(Number(data.totals.partner_amount))}</td>
                        <td className="td" />
                        <td className="td">{money(Number(data.totals.seller_amount))}</td>
                        <td className="td">{money(Number(data.totals.net))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <h3 className="mb-2 mt-5 text-sm font-semibold">Comissões por pessoa</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {personTotals(data).map((p) => (
                    <div key={p.role + p.name} className="rounded-2xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                      <p className="muted text-xs">{p.role} · {p.orders} OS</p>
                      <p className="font-medium">{p.name}</p>
                      <p className="font-display text-xl font-bold">{money(p.total)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {data.rows.length > 0 && <ReportActions partner={partner.id} from={from} to={to} pendingToFreeze={pending} />}
        </>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Relatórios congelados</h2>
      {reports.length === 0 ? <Empty>Nenhum período congelado ainda.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr><th className="th">Nº</th><th className="th">Parceiro</th><th className="th">Período</th><th className="th">OS</th><th className="th">Total cobrado</th><th className="th">Congelado em</th><th className="th" /></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="row">
                  <td className="td font-semibold">{r.number}</td>
                  <td className="td">{r.snapshot.partner}</td>
                  <td className="td">{brDate(r.period_from)} a {brDate(r.period_to)}</td>
                  <td className="td">{r.snapshot.totals.orders}</td>
                  <td className="td">{money(Number(r.snapshot.totals.charged))}</td>
                  <td className="td">{fmtDate(r.created_at)}</td>
                  <td className="td whitespace-nowrap text-right"><ReportDownload reportId={r.id} /> <ReopenButton reportId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
