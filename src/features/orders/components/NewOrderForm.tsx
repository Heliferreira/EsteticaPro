'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Field, FormError, SubmitButton } from '@/components/ui/form';
import { Collapsible } from '@/components/ui/Collapsible';
import { QuickSeller } from '@/features/partners/components/QuickSeller';
import { BODY_TYPE_ORDER, bodyTypeLabel } from '@/lib/car3d/specs';
import { PAINT_PRESETS } from '@/lib/car3d/marks';
import { createOrder } from '../actions';

interface Props {
  customers: Array<{ id: string; name: string }>;
  vehicles: Array<{ id: string; customer_id: string; plate: string; model: string; brand: string | null }>;
  employees: Array<{ id: string; name: string }>;
  defaultCustomerId?: string;
  /** Só dono/gerente recebem estas listas (parceiro e vendedor são opcionais). */
  partners?: Array<{ id: string; name: string }>;
  sellers?: Array<{ id: string; partner_id: string; name: string }>;
}

type Mode = 'existing' | 'new';

function Choice({ value, onChange, labels }: { value: Mode; onChange: (m: Mode) => void; labels: [string, string] }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {(['existing', 'new'] as const).map((m, i) => (
        <button key={m} type="button" className="chip" aria-pressed={value === m} onClick={() => onChange(m)}>{labels[i]}</button>
      ))}
    </div>
  );
}

export function NewOrderForm({ customers, vehicles, employees, defaultCustomerId, partners, sellers = [] }: Props) {
  const [state, action] = useFormState(createOrder, null);
  const [customerMode, setCustomerMode] = useState<Mode>(customers.length === 0 ? 'new' : 'existing');
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '');
  const [vehicleModeRaw, setVehicleMode] = useState<Mode | null>(null);
  const [partnerId, setPartnerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  // Vendedores cadastrados aqui mesmo, durante o preenchimento da OS.
  const [created, setCreated] = useState<Array<{ id: string; partner_id: string; name: string }>>([]);
  const allSellers = [...sellers, ...created.filter((c) => !sellers.some((s) => s.id === c.id))];
  const partnerSellers = allSellers.filter((s) => s.partner_id === partnerId);

  const options = vehicles.filter((v) => v.customer_id === customerId);
  // Cliente novo (ou cliente sem veículos) → cadastra o veículo aqui mesmo.
  const forceNewVehicle = customerMode === 'new' || (customerId !== '' && options.length === 0);
  const vehicleMode: Mode = forceNewVehicle ? 'new' : vehicleModeRaw ?? 'existing';

  return (
    <form action={action} className="card max-w-xl space-y-5">
      <FormError state={state} />
      <input type="hidden" name="customer_mode" value={customerMode} />
      <input type="hidden" name="vehicle_mode" value={vehicleMode} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Cliente</h2>
        {customers.length > 0 && (
          <Choice value={customerMode} onChange={(m) => { setCustomerMode(m); setVehicleMode(null); }}
                  labels={['Cliente já cadastrado', 'Novo cliente']} />
        )}
        {customerMode === 'existing' ? (
          <Field label="Selecione o cliente" name="customer_id" state={state}>
            <select id="customer_id" name="customer_id" className="input" value={customerId}
                    onChange={(e) => { setCustomerId(e.target.value); setVehicleMode(null); }}>
              <option value="" disabled>Selecione…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do cliente" name="new_customer_name" state={state}>
              <input id="new_customer_name" name="new_customer_name" required maxLength={160} className="input" autoFocus />
            </Field>
            <Field label="Telefone / WhatsApp (opcional)" name="new_customer_phone" state={state}>
              <input id="new_customer_phone" name="new_customer_phone" inputMode="tel" maxLength={40} className="input" />
            </Field>
          </div>
        )}
      </section>

      {(customerMode === 'new' || customerId !== '') && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Veículo</h2>
          {!forceNewVehicle && (
            <Choice value={vehicleMode} onChange={setVehicleMode} labels={['Veículo já cadastrado', 'Novo veículo']} />
          )}
          {customerMode === 'existing' && customerId !== '' && options.length === 0 && (
            <p className="muted text-sm">Este cliente ainda não tem veículo. Cadastre o primeiro aqui mesmo.</p>
          )}
          {vehicleMode === 'existing' ? (
            <Field label="Selecione o veículo" name="vehicle_id" state={state}>
              <select id="vehicle_id" name="vehicle_id" className="input" key={customerId} defaultValue="">
                <option value="" disabled>Selecione…</option>
                {options.map((v) => <option key={v.id} value={v.id}>{[v.brand, v.model].filter(Boolean).join(' ')} · {v.plate}</option>)}
              </select>
            </Field>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Placa" name="new_plate" state={state}>
                  <input id="new_plate" name="new_plate" required maxLength={8} className="input font-mono uppercase" placeholder="ABC1D23" />
                </Field>
                <Field label="Tipo de carroceria (modelo 3D)" name="new_body_type" state={state}>
                  <select id="new_body_type" name="new_body_type" className="input" defaultValue="sedan">
                    {BODY_TYPE_ORDER.map((t) => <option key={t} value={t}>{bodyTypeLabel(t)}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Marca" name="new_brand" state={state}>
                  <input id="new_brand" name="new_brand" maxLength={60} className="input" />
                </Field>
                <Field label="Modelo" name="new_model" state={state}>
                  <input id="new_model" name="new_model" required maxLength={80} className="input" />
                </Field>
                <Field label="Ano" name="new_year" state={state}>
                  <input id="new_year" name="new_year" inputMode="numeric" maxLength={4} className="input" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cor (nome)" name="new_color" state={state}>
                  <input id="new_color" name="new_color" maxLength={40} className="input" placeholder="Ex.: Vermelho" />
                </Field>
                <Field label="Cor no 3D" name="new_color_hex" state={state}>
                  <input id="new_color_hex" name="new_color_hex" type="color" defaultValue={PAINT_PRESETS[4].hex}
                         className="h-10 w-full cursor-pointer rounded-md border p-1" style={{ borderColor: 'var(--line)' }} />
                </Field>
              </div>
              <p className="muted text-xs">O cliente e o veículo novos ficam salvos nos cadastros assim que a OS é aberta.</p>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <Field label="Responsável" name="employee_id" state={state}>
          <select id="employee_id" name="employee_id" className="input" defaultValue="">
            <option value="">Definir depois</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        {partners && partners.length > 0 && (
          <Collapsible variant="inset" title="Parceiro e vendedor (opcional)">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Parceiro" name="partner_id" state={state}>
                <select id="partner_id" name="partner_id" className="input" value={partnerId}
                        onChange={(e) => { setPartnerId(e.target.value); setSellerId(''); }}>
                  <option value="">Venda direta (sem parceiro)</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Vendedor do parceiro" name="seller_id" state={state}>
                <select id="seller_id" name="seller_id" className="input" value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                  <option value="">Sem vendedor</option>
                  {partnerSellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            {partnerId && (
              <div className="space-y-2">
                {partnerSellers.length === 0 && <p className="muted text-xs">Este parceiro ainda não tem vendedores.</p>}
                <QuickSeller key={partnerId} partnerId={partnerId}
                             onCreated={(sl) => { setCreated((c) => [...c, sl]); setSellerId(sl.id); }} />
              </div>
            )}
          </Collapsible>
        )}
        <Field label="Observações" name="notes" state={state}>
          <textarea id="notes" name="notes" rows={2} className="input" />
        </Field>
      </section>

      <div className="flex gap-2">
        <SubmitButton pendingText="Criando…">Abrir OS</SubmitButton>
        <Link href="/os" className="btn-ghost">Cancelar</Link>
      </div>
    </form>
  );
}