'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';
import { Collapsible } from '@/components/ui/Collapsible';
import { QuickSeller } from '@/features/partners/components/QuickSeller';
import { BRL } from '@/lib/actions';
import { markStatusInfo } from '@/lib/car3d/marks';
import { partName } from '@/lib/car3d/names';
import { commissionAmount, parseAmount } from '@/features/commissions/calc';
import { saveCommission } from '@/features/commissions/actions';
import { useOrderMarks } from './OrderLive';
import type { BodyType, OrderCommission, Partner, PpfData, Seller, SellerFrom } from '@/types/db';

interface ItemView { id: string; description: string; price: number; ppf: PpfData | null }

interface Props {
  osId: string;
  bodyType: BodyType;
  /** Serviços cadastrados (para mostrar o nome do serviço de cada peça). */
  services: Array<{ id: string; name: string }>;
  items: ItemView[];
  /** Dono/gerente: veem e editam origem e comissões. Operador só vê os serviços e o total. */
  manage: boolean;
  partners: Partner[];
  sellers: Seller[];
  commission: OrderCommission | null;
  frozen: boolean;
}

const fmt = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const isEmpty = (s: string) => parseAmount(s) == null;

function Line({ label, value, muted = false }: { label: React.ReactNode; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className={muted ? 'muted' : undefined}>{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="label !mb-0">{title}</p>
      {children}
    </div>
  );
}

export function OrderSummary({ osId, bodyType, services, items, manage, partners, sellers, commission, frozen }: Props) {
  const { marks } = useOrderMarks();
  const [state, action] = useFormState(saveCommission.bind(null, osId), null);

  const [partnerId, setPartnerId] = useState(commission?.partner_id ?? '');
  const [sellerId, setSellerId] = useState(commission?.seller_id ?? '');
  const [charged, setCharged] = useState(fmt(commission?.charged));
  // Comissões antigas em R$ (de antes da regra "só %") não são convertidas: ficam vazias para você preencher em %.
  const [pVal, setPVal] = useState(commission?.partner_mode === 'pct' ? fmt(commission.partner_value) : '');
  const [sVal, setSVal] = useState(commission?.seller_mode === 'pct' ? fmt(commission.seller_value) : '');
  // De quem sai a comissão do vendedor. Abre sempre na estética (o padrão) e você troca na hora.
  const [sellerFrom, setSellerFrom] = useState<SellerFrom>(commission?.seller_from ?? 'estetica');

  // Vendedores cadastrados aqui mesmo, sem sair da OS.
  const [created, setCreated] = useState<Seller[]>([]);
  const allSellers = [...sellers, ...created.filter((c) => !sellers.some((s) => s.id === c.id))];

  const markList = Object.values(marks);
  const plain = items.filter((i) => !i.ppf);
  const ppf = items.filter((i) => i.ppf);
  const marksTotal = markList.reduce((s, m) => s + Number(m.price), 0);
  const itemsTotal = items.reduce((s, i) => s + Number(i.price), 0);
  const total = marksTotal + itemsTotal;

  const partner = partners.find((p) => p.id === partnerId);
  const seller = allSellers.find((s) => s.id === sellerId);
  const options = allSellers.filter((s) => s.partner_id === partnerId);
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name;

  // Valor cobrado informado (se houver) manda; senão vale o total dos serviços.
  const typedCharged = parseAmount(charged);
  const base = typedCharged != null && !Number.isNaN(typedCharged) ? typedCharged : total;
  const pPct = parseAmount(pVal);
  const sPct = parseAmount(sVal);
  const safe = (v: number | null) => (v == null || Number.isNaN(v) ? null : v);
  // As duas porcentagens são sobre o total. A comissão do vendedor sai da parte da estética ou da parte do parceiro.
  const pShare = partnerId ? commissionAmount('pct', safe(pPct), base) : 0;
  const sAmt = partnerId && seller ? commissionAmount('pct', safe(sPct), base) : 0;
  const fromPartner = sellerFrom === 'parceiro';
  const partnerGets = pShare - (fromPartner ? sAmt : 0);
  const estetica = base - pShare - (fromPartner ? 0 : sAmt);
  const tooHigh = (v: number | null) => v != null && v > 100;

  const choosePartner = (id: string) => {
    setPartnerId(id); setSellerId(''); setSVal('');
    const p = partners.find((x) => x.id === id);
    setPVal(p && p.pct_default ? fmt(p.pct_default) : '');
  };
  const chooseSeller = (id: string) => {
    setSellerId(id);
    const s = allSellers.find((x) => x.id === id);
    setSVal(s && s.pct_default ? fmt(s.pct_default) : '');
  };
  const sellerCreated = (s: Seller) => {
    setCreated((c) => [...c, s]);
    setSellerId(s.id);
    setSVal(s.pct_default ? fmt(s.pct_default) : '');
  };

  const nothing = markList.length === 0 && items.length === 0;

  return (
    <>
      <h2 className="mb-2 mt-6 font-display text-xl font-bold">Resumo e total da OS</h2>
      <div className="card space-y-4">
        {nothing ? (
          <p className="muted text-sm">Nenhum serviço adicionado ainda. Marque peças na vistoria 3D, adicione PPF ou itens avulsos e eles aparecem aqui.</p>
        ) : (
          <>
            {markList.length > 0 && (
              <Group title="Vistoria 3D">
                {markList.map((m) => (
                  <Line key={m.part_id}
                        label={<><b>{partName(bodyType, m.part_id)}</b><span className="muted"> · {markStatusInfo(m.status).label}{serviceName(m.service_id) ? ` · ${serviceName(m.service_id)}` : ''}</span></>}
                        value={BRL.format(Number(m.price))} />
                ))}
              </Group>
            )}
            {ppf.length > 0 && (
              <Group title="PPF">
                {ppf.map((i) => (
                  <Line key={i.id}
                        label={i.ppf?.mode === 'full'
                          ? 'PPF Full (carro completo)'
                          : <>PPF por partes<span className="muted"> · {i.ppf?.parts.map((p) => partName(bodyType, p.id)).join(', ')}</span></>}
                        value={BRL.format(Number(i.price))} />
                ))}
              </Group>
            )}
            {plain.length > 0 && (
              <Group title="Itens avulsos">
                {plain.map((i) => <Line key={i.id} label={i.description} value={BRL.format(Number(i.price))} />)}
              </Group>
            )}
          </>
        )}

        <dl className="space-y-1.5 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-baseline justify-between font-display text-2xl font-bold">
            <dt>Total da OS</dt><dd>{BRL.format(total)}</dd>
          </div>
          {manage && partnerId && (
            <>
              {typedCharged != null && !Number.isNaN(typedCharged) && typedCharged !== total && (
                <Line muted label="Valor cobrado informado (as comissões usam este valor)" value={BRL.format(base)} />
              )}
              <Line muted
                    label={`Parceiro${partner ? ` (${partner.name})` : ''}${pPct != null && !Number.isNaN(pPct) ? ` · ${fmt(pPct)}%` : ''}${seller && fromPartner ? ` · parte de ${BRL.format(pShare)} menos a comissão do vendedor` : ''}`}
                    value={BRL.format(partnerGets)} />
              {seller && (
                <Line muted
                      label={`Vendedor (${seller.name})${sPct != null && !Number.isNaN(sPct) ? ` · ${fmt(sPct)}%` : ''} · sai da parte ${fromPartner ? 'do parceiro' : 'da estética'}`}
                      value={BRL.format(sAmt)} />
              )}
              <div className="flex items-baseline justify-between pt-1 text-base font-semibold">
                <dt>Estética fica</dt><dd>{BRL.format(estetica)}</dd>
              </div>
              {fromPartner && partnerGets < 0 && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>A comissão do vendedor é maior que a parte do parceiro. Confira as porcentagens.</p>}
              {estetica < 0 && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>As comissões somam mais que o valor cobrado. Confira as porcentagens.</p>}
            </>
          )}
        </dl>
      </div>

      {manage && (
        <form action={action} className="mt-6">
          <Collapsible
            title="Origem e comissões"
            hint="Opcional. Só dono e gerente veem isto."
            badge={frozen ? 'Congelada' : partner ? partner.name : 'Venda direta'}
          >
            <p className="muted text-sm">Tudo opcional: a OS funciona normalmente sem parceiro nem comissão. As porcentagens são sobre o valor cobrado: o parceiro recebe a parte dele e o restante é da estética. A comissão do vendedor sai da parte que você escolher.</p>
            {frozen && (
              <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}>
                Esta OS está <b>congelada</b> em um relatório enviado. Para editar, reabra o período em Relatórios.
              </p>
            )}
            <FormError state={state} />
            <FormMessage state={state} />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Parceiro" name="partner_id" state={state}>
                <select id="partner_id" name="partner_id" className="input" value={partnerId} disabled={frozen}
                        onChange={(e) => choosePartner(e.target.value)}>
                  <option value="">Venda direta (sem parceiro)</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Valor cobrado (R$)" name="charged" state={state}
                     hint={`Vazio = usa o total da OS (${BRL.format(total)}).`}>
                <input id="charged" name="charged" className="input" inputMode="decimal" disabled={frozen}
                       value={charged} onChange={(e) => setCharged(e.target.value)} />
              </Field>
            </div>

            {partnerId && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Parte do parceiro (%)" name="partner_value" state={state}
                       hint="Porcentagem do total que vai para o parceiro. O restante é da estética.">
                  <input id="partner_value" name="partner_value" className="input" inputMode="decimal" placeholder="Ex.: 10" disabled={frozen}
                         value={pVal} onChange={(e) => setPVal(e.target.value)} />
                </Field>

                <div>
                  <Field label="Vendedor" name="seller_id" state={state}>
                    <select id="seller_id" name="seller_id" className="input" value={sellerId} disabled={frozen}
                            onChange={(e) => chooseSeller(e.target.value)}>
                      <option value="">Sem vendedor</option>
                      {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <div className="mt-2 space-y-2">
                    {options.length === 0 && <p className="muted text-xs">Este parceiro ainda não tem vendedores.</p>}
                    {!frozen && <QuickSeller key={partnerId} partnerId={partnerId} onCreated={sellerCreated} />}
                  </div>
                </div>

                {seller && (
                  <>
                    <Field label="Comissão do vendedor (%)" name="seller_value" state={state} hint="Porcentagem sobre o total da OS.">
                      <input id="seller_value" name="seller_value" className="input" inputMode="decimal" placeholder="Ex.: 10" disabled={frozen}
                             value={sVal} onChange={(e) => setSVal(e.target.value)} />
                    </Field>
                    <Field label="A comissão do vendedor sai da parte de" name="seller_from" state={state}>
                      <select id="seller_from" name="seller_from" className="input" value={sellerFrom} disabled={frozen}
                              onChange={(e) => setSellerFrom(e.target.value as SellerFrom)}>
                        <option value="estetica">Estética</option>
                        <option value="parceiro">Parceiro</option>
                      </select>
                    </Field>
                  </>
                )}
              </div>
            )}

            {partnerId && !frozen && (isEmpty(pVal) || (seller && isEmpty(sVal))) && (
              <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}>
                Atenção: {isEmpty(pVal) ? 'a parte do parceiro está vazia' : 'a comissão do vendedor está vazia'}.
                No relatório ela vai aparecer como R$ 0,00. Preencha a porcentagem, ou deixe assim se realmente não há comissão.
              </p>
            )}
            {(tooHigh(pPct) || tooHigh(sPct)) && (
              <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>A porcentagem não pode passar de 100%.</p>
            )}

            {!frozen && <SubmitButton>Salvar origem e comissões</SubmitButton>}
          </Collapsible>
        </form>
      )}
    </>
  );
}