'use client';

import { useMemo, useState, useTransition } from 'react';
import { VistoriaViewer } from '@/features/orders/components/VistoriaViewer';
import { useOrderMarks } from '@/features/orders/components/OrderLive';
import { MARK_STATUS } from '@/lib/car3d/marks';
import { BRL } from '@/lib/actions';
import { removeMark, saveMark } from '@/features/orders/actions';
import type { PartInfo } from '@/lib/car3d/scene';
import type { BodyType, MarkStatus } from '@/types/db';

export interface MarkRow { part_id: string; status: MarkStatus; service_id: string | null; price: number; note: string | null }
interface ServiceOpt { id: string; name: string; default_price: number }

interface Props {
  osId: string;
  bodyType: BodyType;
  paint: string;
  services: ServiceOpt[];
  itemsTotal: number;
  /** partes cobertas por PPF (pintadas em turquesa no 3D) */
  ppfParts: string[];
  readOnly: boolean;
}

interface Draft { status: MarkStatus; service_id: string; price: string; note: string }

const fmtInput = (n: number) => (n ? String(n).replace('.', ',') : '');
const toNumber = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;

export function InspectionWorkspace({ osId, bodyType, paint, services, itemsTotal, ppfParts, readOnly }: Props) {
  // As marcações ficam no <OrderLive> para o resumo no fim da OS acompanhar ao vivo.
  const { marks, setMarks } = useOrderMarks();
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ status: 'ok', service_id: '', price: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const statusMap = useMemo(() => {
    const map: Record<string, string> = Object.fromEntries(ppfParts.map((id) => [id, 'ppf']));
    for (const m of Object.values(marks)) map[m.part_id] = m.status === 'ok' && map[m.part_id] === 'ppf' ? 'ppf' : m.status;
    return map;
  }, [marks, ppfParts]);
  const marksTotal = Object.values(marks).reduce((s, m) => s + Number(m.price), 0);
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name;

  function select(id: string | null) {
    setSelected(id);
    setError(null);
    if (!id) return;
    const m = marks[id];
    setDraft(m
      ? { status: m.status, service_id: m.service_id ?? '', price: fmtInput(Number(m.price)), note: m.note ?? '' }
      : { status: 'ok', service_id: '', price: '', note: '' });
  }

  function pickService(id: string) {
    const svc = services.find((s) => s.id === id);
    setDraft((d) => ({ ...d, service_id: id, price: svc ? fmtInput(Number(svc.default_price)) : d.price }));
  }

  function save() {
    if (!selected || readOnly) return;
    const part = selected;
    setError(null);
    start(async () => {
      const res = await saveMark(osId, { part_id: part, status: draft.status, service_id: draft.service_id, price: draft.price, note: draft.note });
      if (res.error) { setError(res.error); return; }
      setMarks((prev) => {
        const next = { ...prev };
        const empty = draft.status === 'ok' && !draft.service_id && !toNumber(draft.price) && !draft.note.trim();
        if (empty) delete next[part];
        else next[part] = { part_id: part, status: draft.status, service_id: draft.service_id || null, price: toNumber(draft.price), note: draft.note.trim() || null };
        return next;
      });
    });
  }

  function clear(part: string) {
    if (readOnly) return;
    start(async () => {
      const res = await removeMark(osId, part);
      if (res.error) { setError(res.error); return; }
      setMarks((prev) => { const n = { ...prev }; delete n[part]; return n; });
      if (selected === part) setDraft({ status: 'ok', service_id: '', price: '', note: '' });
    });
  }

  const list = Object.values(marks);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <VistoriaViewer bodyType={bodyType} paint={paint} marks={statusMap} selected={selected}
                        onSelect={select} onParts={(p: PartInfo[]) => setNames(Object.fromEntries(p.map((x) => [x.id, x.name])))} />
        <p className="muted mt-2 text-xs">Arraste para girar, role para dar zoom e clique em uma peça para registrar ocorrência e serviço.</p>
      </div>

      <div className="space-y-4">
        <div className="card">
          {!selected ? (
            <p className="muted text-sm">Nenhuma peça selecionada.</p>
          ) : (
            <div className="space-y-3">
              <p className="font-display text-xl font-bold">{names[selected] ?? selected}</p>
              <div className="flex flex-wrap gap-1.5">
                {MARK_STATUS.map((s) => (
                  <button key={s.id} type="button" disabled={readOnly}
                          onClick={() => setDraft((d) => ({ ...d, status: s.id }))}
                          className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                          style={{
                            borderColor: draft.status === s.id ? 'var(--accent)' : 'var(--line)',
                            background: draft.status === s.id ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                          }}>
                    <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: s.color ?? 'var(--muted)' }} />
                    {s.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="label" htmlFor="svc">Serviço</label>
                <select id="svc" className="input" disabled={readOnly} value={draft.service_id} onChange={(e) => pickService(e.target.value)}>
                  <option value="">Sem serviço</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="price">Preço (R$)</label>
                <input id="price" className="input" inputMode="decimal" disabled={readOnly} value={draft.price}
                       onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="label" htmlFor="note">Observação</label>
                <textarea id="note" rows={2} maxLength={300} className="input" disabled={readOnly} value={draft.note}
                          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
              </div>
              {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              {!readOnly && (
                <div className="flex gap-2">
                  <button type="button" className="btn" disabled={pending} onClick={save}>{pending ? 'Salvando…' : 'Salvar peça'}</button>
                  {marks[selected] && <button type="button" className="btn-ghost" disabled={pending} onClick={() => clear(selected)}>Limpar</button>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="label">Resumo da vistoria</h3>
          {list.length === 0 ? <p className="muted text-sm">Nenhuma peça marcada.</p> : (
            <ul className="space-y-1.5 text-sm">
              {list.map((m) => {
                const st = MARK_STATUS.find((s) => s.id === m.status);
                return (
                  <li key={m.part_id}>
                    <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => select(m.part_id)}>
                      <span>
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: st?.color ?? 'var(--muted)' }} />
                        <b>{names[m.part_id] ?? m.part_id}</b>
                        <span className="muted"> · {st?.label}{serviceName(m.service_id) ? ` · ${serviceName(m.service_id)}` : ''}</span>
                      </span>
                      <span className="shrink-0">{BRL.format(Number(m.price))}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <dl className="mt-3 space-y-1 border-t pt-3 text-sm" style={{ borderColor: 'var(--line)' }}>
            <div className="flex justify-between"><dt className="muted">Peças</dt><dd>{BRL.format(marksTotal)}</dd></div>
            <div className="flex justify-between"><dt className="muted">Itens avulsos</dt><dd>{BRL.format(itemsTotal)}</dd></div>
            <div className="flex justify-between font-display text-xl font-bold"><dt>Total</dt><dd>{BRL.format(marksTotal + itemsTotal)}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}