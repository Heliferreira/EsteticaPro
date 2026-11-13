'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Field, FormError, FormMessage, SubmitButton } from '@/components/ui/form';
import { Collapsible } from '@/components/ui/Collapsible';
import { BRL } from '@/lib/actions';
import { commissionAmount, parseAmount } from '../calc';
import { saveCommission } from '../actions';
import type { CommissionMode, OrderCommission, Partner, Seller } from '@/types/db';

const fmt = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

function Commission({ label, name, mode, value, onMode, onValue, disabled, error }: {
  label: string; name: 'partner' | 'seller'; mode: CommissionMode; value: string;
  onMode: (m: CommissionMode) => void; onValue: (v: string) => void; disabled: boolean; error?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={`${name}_value`}>{label}</label>
      <div className="flex gap-2">
        <select name={`${name}_mode`} value={mode} onChange={(e) => onMode(e.target.value as CommissionMode)}
                className="input !w-24" aria-label="Tipo da comissão" disabled={disabled}>
          <option value="pct">%</option>
          <option value="val">R$</option>
        </select>
        <input id={`${name}_value`} name={`${name}_value`} value={value} onChange={(e) => onValue(e.target.value)}
               inputMode="decimal" placeholder="sem comissão" className="input" disabled={disabled} />
      </div>
      {error && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}

export function CommissionCard({ osId, osTotal, partners, sellers, commission, frozen }: {
  osId: string; osTotal: number; partners: Partner[]; sellers: Seller[];
  commission: OrderCommission | null; frozen: boolean;
}) {
  const [state, action] = useFormState(saveCommission.bind(null, osId), null);
  const [partnerId, setPartnerId] = useState(commission?.partner_id ?? '');
  const [sellerId, setSellerId] = useState(commission?.seller_id ?? '');
  const [charged, setCharged] = useState(fmt(commission?.charged ?? null));
  const [pMode, setPMode] = useState<CommissionMode>(commission?.partner_mode ?? 'pct');
  const [pVal, setPVal] = useState(fmt(commission?.partner_value ?? null));
  const [sMode, setSMode] = useState<CommissionMode>(commission?.seller_mode ?? 'pct');
  const [sVal, setSVal] = useState(fmt(commission?.seller_value ?? null));

  const partner = partners.find((p) => p.id === partnerId);
  const seller = sellers.find((s) => s.id === sellerId);
  const options = sellers.filter((s) => s.partner_id === partnerId);

  const parsedCharged = parseAmount(charged);
  const base = parsedCharged != null && !Number.isNaN(parsedCharged) ? parsedCharged : osTotal;
  const pAmt = commissionAmount(pMode, Number.isNaN(parseAmount(pVal) ?? 0) ? null : parseAmount(pVal), base);
  const sAmt = seller ? commissionAmount(sMode, Number.isNaN(parseAmount(sVal) ?? 0) ? null : parseAmount(sVal), base) : 0;
  const net = base - pAmt - sAmt;
  const pctTooHigh = (m: CommissionMode, v: string) => m === 'pct' && (parseAmount(v) ?? 0) > 100;

  const choosePartner = (id: string) => {
    setPartnerId(id); setSellerId(''); setSVal(''); setSMode('pct');
    const p = partners.find((x) => x.id === id);
    setPMode('pct'); setPVal(p && p.pct_default ? fmt(p.pct_default) : '');
  };
  const chooseSeller = (id: string) => {
    setSellerId(id);
    const s = sellers.find((x) => x.id === id);
    setSMode('pct'); setSVal(s && s.pct_default ? fmt(s.pct_default) : '');
  };

  return (
    <form action={action} className="mt-6">
      <Collapsible
        title="Origem e comissões"
        hint="Opcional. Só dono e gerente veem isto."
        badge={frozen ? 'Congelada' : partner ? partner.name : 'Venda direta'}
      >
      <p className="muted text-sm">Tudo opcional: a OS funciona normalmente sem parceiro nem comissão.</p>
      {frozen && <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}>
        Esta OS está <b>congelada</b> em um relatório enviado. Para editar, reabra o período em Relatórios.</p>}
      <FormError state={state} />
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Parceiro" name="partner_id" state={state}>
          <select id="partner_id" name="partner_id" className="input" value={partnerId} disabled={frozen} onChange={(e) => choosePartner(e.target.value)}>
            <option value="">Venda direta (sem parceiro)</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        {partnerId && (
          <Field label="Vendedor" name="seller_id" state={state}>
            <select id="seller_id" name="seller_id" className="input" value={sellerId} disabled={frozen} onChange={(e) => chooseSeller(e.target.value)}>
              <option value="">Sem vendedor</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Valor cobrado (R$)" name="charged" state={state} hint={`Vazio = usa o total da OS (${BRL.format(osTotal)}).`}>
          <input id="charged" name="charged" value={charged} onChange={(e) => setCharged(e.target.value)} inputMode="decimal" className="input" disabled={frozen} />
        </Field>
      </div>

      {partnerId && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Commission label={`Comissão do parceiro (${partner?.name ?? ''})`} name="partner" mode={pMode} value={pVal}
                        onMode={(m) => { setPMode(m); if (m === 'pct' && pctTooHigh(m, pVal)) setPVal(''); }} onValue={setPVal} disabled={frozen}
                        error={pctTooHigh(pMode, pVal) ? 'Percentual não pode passar de 100%. Para valor fixo, troque % por R$.' : state?.fieldErrors?.partner_value} />
            {seller && (
              <Commission label={`Comissão do vendedor (${seller.name})`} name="seller" mode={sMode} value={sVal}
                          onMode={(m) => { setSMode(m); if (m === 'pct' && pctTooHigh(m, sVal)) setSVal(''); }} onValue={setSVal} disabled={frozen}
                          error={pctTooHigh(sMode, sVal) ? 'Percentual não pode passar de 100%. Para valor fixo, troque % por R$.' : state?.fieldErrors?.seller_value} />
            )}
          </div>
          {net < 0 && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>As comissões somam mais que o valor cobrado. Confira os valores.</p>}
          <dl className="space-y-1.5 rounded-2xl p-4 text-sm" style={{ background: 'var(--surface-2)' }}>
            <div className="flex justify-between"><dt className="muted">Valor cobrado</dt><dd>{BRL.format(base)}</dd></div>
            <div className="flex justify-between"><dt className="muted">Comissão do parceiro (−)</dt><dd>{BRL.format(pAmt)}</dd></div>
            {seller && <div className="flex justify-between"><dt className="muted">Comissão de {seller.name} (−)</dt><dd>{BRL.format(sAmt)}</dd></div>}
            <div className="flex justify-between text-base font-semibold"><dt>Líquido da estética</dt><dd>{BRL.format(net)}</dd></div>
          </dl>
        </>
      )}
      {!frozen && <SubmitButton>Salvar origem e comissões</SubmitButton>}
      </Collapsible>
    </form>
  );
}