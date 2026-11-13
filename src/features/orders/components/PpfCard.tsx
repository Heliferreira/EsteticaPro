'use client';

import { useState, useTransition } from 'react';
import { BRL } from '@/lib/actions';
import { Collapsible } from '@/components/ui/Collapsible';
import { ppfGroups, ppfPartName } from '@/lib/car3d/ppf';
import { addPpf } from '@/features/orders/actions';
import type { BodyType, PpfData } from '@/types/db';

interface PpfService { id: string; name: string; default_price: number; part_price: number }
export interface PpfItemView { id: string; price: number; ppf: PpfData }

interface Props {
  osId: string;
  bodyType: BodyType;
  services: PpfService[];
  items: PpfItemView[];
  readOnly: boolean;
  removeAction: (fd: FormData) => Promise<void>;
}

const fmtIn = (n: number) => (n ? String(n).replace('.', ',') : '');
const toNum = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;

export function PpfCard({ osId, bodyType, services, items, readOnly, removeAction }: Props) {
  const [svcId, setSvcId] = useState(services[0]?.id ?? '');
  const svc = services.find((s) => s.id === svcId);
  const [mode, setMode] = useState<'full' | 'parts'>('parts');
  const [full, setFull] = useState(fmtIn(services[0]?.default_price ?? 0));
  const [parts, setParts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = ppfGroups(bodyType);

  const total = mode === 'full' ? toNum(full) : Object.values(parts).reduce((s, v) => s + toNum(v), 0);

  function changeService(id: string) {
    const s = services.find((x) => x.id === id);
    setSvcId(id);
    if (s) {
      setFull(fmtIn(s.default_price));
      setParts((p) => Object.fromEntries(Object.keys(p).map((k) => [k, fmtIn(s.part_price)])));
    }
  }
  function toggle(id: string, on: boolean) {
    setParts((p) => {
      const n = { ...p };
      if (on) n[id] = fmtIn(svc?.part_price ?? 0); else delete n[id];
      return n;
    });
  }
  function markGroup(title: string, on: boolean) {
    const g = groups.find((x) => x.title === title);
    if (!g) return;
    setParts((p) => {
      const n = { ...p };
      g.parts.forEach((x) => { if (on) { if (n[x.id] === undefined) n[x.id] = fmtIn(svc?.part_price ?? 0); } else delete n[x.id]; });
      return n;
    });
  }
  function submit() {
    setError(null);
    start(async () => {
      const res = await addPpf(osId, {
        service_id: svcId, mode, full_price: full,
        parts: Object.entries(parts).map(([id, price]) => ({ id, price })),
      });
      if (res.error) { setError(res.error); return; }
      setParts({});
    });
  }

  return (
    <Collapsible
      className="mt-6"
      title="PPF (película de proteção)"
      hint="Aplicação completa (Full) ou só em algumas partes. As partes escolhidas ficam em azul-turquesa no 3D."
      badge={items.length === 0 ? 'Nenhum aplicado' : `${items.length} aplicado${items.length > 1 ? 's' : ''}`}
    >
      {items.length === 0 ? (
        <p className="muted text-sm">Nenhum PPF aplicado nesta OS.</p>
      ) : (
        <div>
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm" style={{ borderColor: 'var(--line)' }}>
              <div className="flex flex-col gap-1.5">
                <b>{i.ppf.mode === 'full' ? 'PPF Full (carro completo)' : 'PPF por partes'}</b>
                <div className="flex flex-wrap gap-1.5">
                  {i.ppf.mode === 'full'
                    ? <span className="badge">Full</span>
                    : i.ppf.parts.map((p) => (
                        <span key={p.id} className="badge" style={{ background: 'rgba(63,182,201,.18)', color: '#6fd3e3' }}>
                          {ppfPartName(bodyType, p.id)} · {BRL.format(Number(p.price))}
                        </span>
                      ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {BRL.format(Number(i.price))}
                {!readOnly && (
                  <form action={removeAction}>
                    <input type="hidden" name="os_id" value={osId} />
                    <input type="hidden" name="id" value={i.id} />
                    <button className="btn-danger">Remover</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (services.length === 0 ? (
        <p className="muted mt-4 text-sm">Cadastre um serviço do tipo PPF em Serviços para aplicar aqui.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ppf_svc">Serviço</label>
              <select id="ppf_svc" className="input" value={svcId} onChange={(e) => changeService(e.target.value)}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <span className="label">Aplicação</span>
              <div className="flex gap-2">
                <button type="button" className="chip" aria-pressed={mode === 'parts'} onClick={() => setMode('parts')}>Por partes</button>
                <button type="button" className="chip" aria-pressed={mode === 'full'} onClick={() => setMode('full')}>Full (completo)</button>
              </div>
            </div>
          </div>

          {mode === 'full' ? (
            <div className="max-w-[220px]">
              <label className="label" htmlFor="ppf_full">Preço do PPF Full (R$)</label>
              <input id="ppf_full" className="input" inputMode="decimal" value={full} onChange={(e) => setFull(e.target.value)} />
              <p className="muted mt-2 text-xs">Cobre todas as partes pintadas do veículo.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {groups.map((g) => {
                  const isOpen = !!open[g.title];
                  const selected = g.parts.filter((p) => parts[p.id] !== undefined);
                  const subtotal = selected.reduce((sum, p) => sum + toNum(parts[p.id]), 0);
                  const panelId = `ppf-grp-${g.title.replace(/\s+/g, '-')}`;
                  return (
                    <div key={g.title} className="overflow-hidden rounded-2xl" style={{ background: 'var(--surface-2)' }}>
                      <button type="button" aria-expanded={isOpen} aria-controls={panelId}
                              onClick={() => setOpen((o) => ({ ...o, [g.title]: !o[g.title] }))}
                              className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                        <span className="flex-1 font-medium">{g.title}</span>
                        {selected.length > 0
                          ? <span className="badge" style={{ background: 'rgba(63,182,201,.18)', color: '#6fd3e3' }}>
                              {selected.length} {selected.length === 1 ? 'peça' : 'peças'} · {BRL.format(subtotal)}
                            </span>
                          : <span className="muted text-xs">{g.parts.length} peças</span>}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                             style={{ transition: 'transform .2s', transform: `rotate(${isOpen ? 180 : 0}deg)`, flex: 'none' }}>
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div id={panelId} className="space-y-1.5 px-3 pb-3">
                          {g.parts.map((p) => {
                            const on = parts[p.id] !== undefined;
                            return (
                              <div key={p.id} className="flex min-w-0 items-center gap-2 rounded-2xl px-3 py-1.5" style={{ background: 'var(--surface)' }}>
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
                                  <input type="checkbox" checked={on} onChange={(e) => toggle(p.id, e.target.checked)} /> <span>{p.name}</span>
                                </label>
                                {on && (
                                  <input className="input !w-24 shrink-0 !rounded-xl !px-2 !py-1" inputMode="decimal" aria-label={`Preço ${p.name}`}
                                         value={parts[p.id]} onChange={(e) => setParts((s) => ({ ...s, [p.id]: e.target.value }))} />
                                )}
                              </div>
                            );
                          })}
                          <div className="flex gap-2 pt-1">
                            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => markGroup(g.title, true)}>Marcar o grupo</button>
                            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => markGroup(g.title, false)}>Limpar o grupo</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => setParts(Object.fromEntries(groups.flatMap((g) => g.parts).map((p) => [p.id, parts[p.id] ?? fmtIn(svc?.part_price ?? 0)])))}>
                  Marcar todas
                </button>
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setParts({})}>Limpar seleção</button>
              </div>
            </>
          )}

          {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex items-center gap-4">
            <button type="button" className="btn" disabled={pending} onClick={submit}>{pending ? 'Adicionando…' : 'Adicionar PPF à OS'}</button>
            <span className="muted text-sm">Total: <b style={{ color: 'var(--ink)' }}>{BRL.format(total)}</b></span>
          </div>
        </div>
      ))}
    </Collapsible>
  );
}