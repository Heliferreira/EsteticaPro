'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireContext, canManage } from '@/lib/auth';
import { friendlyError, parseForm, type FormState } from '@/lib/actions';
import {
  inlineCustomerSchema, inlineVehicleSchema, itemSchema, markSchema, newOrderSchema, optText, optUuid, ppfSchema, uuid,
} from '@/lib/validation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fields = Record<string, string>;

/** Copia os erros de um schema para os nomes de campo do formulário (ex.: plate -> new_plate). */
function addErrors(into: Fields, issues: Array<{ path: PropertyKey[]; message: string }>, rename: (k: string) => string) {
  for (const i of issues) {
    const key = rename(String(i.path[0] ?? '_'));
    if (!into[key]) into[key] = i.message;
  }
}

export async function createOrder(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(newOrderSchema, fd);
  if (!p.ok) return p.state;
  const raw = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
  const s = (k: string) => String(raw[k] ?? '');

  // Cliente novo sempre cadastra o veículo junto.
  const newCustomer = p.data.customer_mode === 'new';
  const newVehicle = newCustomer || p.data.vehicle_mode === 'new';
  const fieldErrors: Fields = {};

  let customerId = '';
  let vehicleId = '';
  let customerData: z.infer<typeof inlineCustomerSchema> | null = null;
  let vehicleData: z.infer<typeof inlineVehicleSchema> | null = null;

  if (newCustomer) {
    const r = inlineCustomerSchema.safeParse({ name: s('new_customer_name'), phone: s('new_customer_phone') });
    if (r.success) customerData = r.data;
    else addErrors(fieldErrors, r.error.issues, (k) => (k === 'name' ? 'new_customer_name' : 'new_customer_phone'));
  } else {
    const r = uuid.safeParse(s('customer_id'));
    if (r.success) customerId = r.data;
    else fieldErrors.customer_id = 'Selecione o cliente.';
  }

  if (newVehicle) {
    const r = inlineVehicleSchema.safeParse({
      plate: s('new_plate'), brand: s('new_brand'), model: s('new_model'), year: s('new_year'),
      color: s('new_color'), color_hex: s('new_color_hex') || '#b3121c', body_type: s('new_body_type') || 'sedan',
    });
    if (r.success) vehicleData = r.data;
    else addErrors(fieldErrors, r.error.issues, (k) => `new_${k}`);
  } else {
    const r = uuid.safeParse(s('vehicle_id'));
    if (r.success) vehicleId = r.data;
    else fieldErrors.vehicle_id = 'Selecione o veículo.';
  }

  if (Object.keys(fieldErrors).length > 0) return { error: 'Confira os campos destacados.', fieldErrors };

  const { supabase, companyId, role } = await requireContext();

  // Placa repetida é o erro mais provável: confere antes de criar qualquer coisa.
  if (vehicleData) {
    const { data: dup } = await supabase.from('vehicles').select('id').eq('plate', vehicleData.plate).maybeSingle();
    if (dup) {
      return { error: 'Confira os campos destacados.', fieldErrors: { new_plate: 'Já existe um veículo com esta placa. Use "Veículo já cadastrado".' } };
    }
  }

  // Cria cliente/veículo novos. Se algo falhar adiante, desfaz o que foi criado agora (melhor esforço).
  let createdCustomer: string | null = null;
  let createdVehicle: string | null = null;
  const rollback = async () => {
    if (createdVehicle) await supabase.from('vehicles').delete().eq('id', createdVehicle);
    if (createdCustomer) await supabase.from('customers').delete().eq('id', createdCustomer);
  };

  if (customerData) {
    const { data, error } = await supabase.from('customers')
      .insert({ ...customerData, company_id: companyId }).select('id').single();
    if (error || !data) return { error: friendlyError(error ?? { message: 'Não foi possível cadastrar o cliente.' }) };
    createdCustomer = data.id as string;
    customerId = createdCustomer;
  }
  if (vehicleData) {
    const { data, error } = await supabase.from('vehicles')
      .insert({ ...vehicleData, customer_id: customerId, company_id: companyId }).select('id').single();
    if (error || !data) {
      await rollback();
      return { error: friendlyError(error ?? { message: 'Não foi possível cadastrar o veículo.' }) };
    }
    createdVehicle = data.id as string;
    vehicleId = createdVehicle;
  }

  const { data, error } = await supabase.rpc('create_work_order', {
    p_customer: customerId,
    p_vehicle: vehicleId,
    p_employee: p.data.employee_id,
    p_notes: p.data.notes,
  });
  if (error) {
    await rollback();
    return { error: friendlyError(error) };
  }

  // Parceiro/vendedor são opcionais e só dono/gerente informam. Já sugere as comissões padrão.
  if (p.data.partner_id && canManage(role)) {
    const [pq, sq] = await Promise.all([
      supabase.from('partners').select('pct_default').eq('id', p.data.partner_id).maybeSingle(),
      p.data.seller_id
        ? supabase.from('sellers').select('pct_default, partner_id').eq('id', p.data.seller_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const sellerOk = sq.data && (sq.data as { partner_id: string }).partner_id === p.data.partner_id;
    const num = (v: unknown) => (Number(v) > 0 ? Number(v) : null);
    await supabase.from('work_order_commissions').insert({
      work_order_id: data as string,
      company_id: companyId,
      partner_id: p.data.partner_id,
      seller_id: sellerOk ? p.data.seller_id : null,
      partner_value: num(pq.data?.pct_default),
      seller_value: sellerOk ? num((sq.data as { pct_default: number }).pct_default) : null,
    });
  }
  revalidatePath('/os');
  redirect(`/os/${data as string}`);
}

const updateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'done', 'delivered', 'cancelled']),
  employee_id: optUuid,
  notes: optText(500),
});

export async function updateOrder(id: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!UUID.test(id)) return { error: 'OS inválida.' };
  const p = parseForm(updateSchema, fd);
  if (!p.ok) return p.state;
  const { supabase } = await requireContext();
  const { error } = await supabase.from('work_orders').update(p.data).eq('id', id);
  if (error) return { error: friendlyError(error) };

  // Ao concluir/entregar, baixa o estoque dos serviços usados (idempotente no banco).
  let extra = '';
  if (p.data.status === 'done' || p.data.status === 'delivered') {
    const { data: n, error: stockErr } = await supabase.rpc('consume_order_stock', { p_order: id });
    if (stockErr) return { error: `OS salva, mas a baixa de estoque falhou: ${friendlyError(stockErr)}` };
    if (Number(n) > 0) extra = ` Baixa de estoque feita (${n} produto${Number(n) > 1 ? 's' : ''}).`;
  }
  revalidatePath(`/os/${id}`);
  revalidatePath('/os');
  revalidatePath('/estoque');
  return { message: `Dados da OS salvos.${extra}` };
}

async function orderCompany(osId: string) {
  const ctx = await requireContext();
  if (!UUID.test(osId)) return { ctx, companyId: null };
  const { data } = await ctx.supabase.from('work_orders').select('company_id').eq('id', osId).maybeSingle();
  return { ctx, companyId: (data?.company_id as string | undefined) ?? null };
}

export interface MarkInput {
  part_id: string;
  status: string;
  service_id: string;
  price: string;
  note: string;
}

/** Cria/atualiza a marcação de uma peça. Se ficar vazia (sem ocorrência, serviço, preço e nota), remove. */
export async function saveMark(osId: string, input: MarkInput): Promise<{ error?: string }> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const m = parsed.data;
  if (!/^[A-Za-z0-9]{1,40}$/.test(m.part_id)) return { error: 'Peça inválida.' };

  const { ctx, companyId } = await orderCompany(osId);
  if (!companyId) return { error: 'OS não encontrada.' };

  const empty = m.status === 'ok' && !m.service_id && m.price === 0 && !m.note;
  if (empty) {
    const { error } = await ctx.supabase.from('work_order_marks').delete().eq('work_order_id', osId).eq('part_id', m.part_id);
    return error ? { error: friendlyError(error) } : {};
  }
  const { error } = await ctx.supabase.from('work_order_marks').upsert(
    { company_id: companyId, work_order_id: osId, part_id: m.part_id, status: m.status, service_id: m.service_id, price: m.price, note: m.note },
    { onConflict: 'work_order_id,part_id' },
  );
  return error ? { error: friendlyError(error) } : {};
}

export async function removeMark(osId: string, partId: string): Promise<{ error?: string }> {
  const { ctx, companyId } = await orderCompany(osId);
  if (!companyId) return { error: 'OS não encontrada.' };
  const { error } = await ctx.supabase.from('work_order_marks').delete().eq('work_order_id', osId).eq('part_id', partId);
  return error ? { error: friendlyError(error) } : {};
}

export async function addItem(osId: string, _: FormState, fd: FormData): Promise<FormState> {
  const p = parseForm(itemSchema, fd);
  if (!p.ok) return p.state;
  const { ctx, companyId } = await orderCompany(osId);
  if (!companyId) return { error: 'OS não encontrada.' };
  const { error } = await ctx.supabase.from('work_order_items').insert({ ...p.data, company_id: companyId, work_order_id: osId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/os/${osId}`);
  return { message: 'Item adicionado.' };
}

export async function removeItem(fd: FormData) {
  const osId = String(fd.get('os_id') ?? '');
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(osId) || !UUID.test(id)) redirect('/os');
  const { supabase } = await requireContext();
  await supabase.from('work_order_items').delete().eq('id', id).eq('work_order_id', osId);
  revalidatePath(`/os/${osId}`);
  redirect(`/os/${osId}`);
}

export interface PpfInput {
  service_id: string;
  mode: 'full' | 'parts';
  full_price: string;
  parts: Array<{ id: string; price: string }>;
}

/** Adiciona uma aplicação de PPF (Full ou por partes) à OS como um item com as partes escolhidas. */
export async function addPpf(osId: string, input: PpfInput): Promise<{ error?: string }> {
  const parsed = ppfSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const d = parsed.data;
  const { ctx, companyId } = await orderCompany(osId);
  if (!companyId) return { error: 'OS não encontrada.' };

  const { data: svc } = await ctx.supabase.from('services').select('id, kind').eq('id', d.service_id).maybeSingle();
  if (!svc || svc.kind !== 'ppf') return { error: 'Escolha um serviço do tipo PPF.' };

  let price: number;
  let ppf: { mode: 'full' | 'parts'; parts: Array<{ id: string; price: number }> };
  if (d.mode === 'full') {
    if (d.full_price <= 0) return { error: 'Informe o preço do PPF Full.' };
    price = d.full_price;
    ppf = { mode: 'full', parts: [] };
  } else {
    const seen = new Set<string>();
    const parts = d.parts.filter((p) => !seen.has(p.id) && seen.add(p.id));
    if (parts.length === 0) return { error: 'Selecione ao menos uma parte do veículo.' };
    price = parts.reduce((s, p) => s + p.price, 0);
    ppf = { mode: 'parts', parts };
  }
  const { error } = await ctx.supabase.from('work_order_items').insert({
    company_id: companyId, work_order_id: osId, service_id: d.service_id,
    description: d.mode === 'full' ? 'PPF Full' : 'PPF por partes', price, ppf,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/os/${osId}`);
  return {};
}