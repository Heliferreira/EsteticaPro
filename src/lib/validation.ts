import { z } from 'zod';

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const optText = (max = 200) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
export const reqText = (min: number, max: number, msg: string) =>
  z.string({ required_error: msg }).trim().min(min, msg).max(max, `Máximo de ${max} caracteres.`);

/** Aceita "1.234,56", "80,5" ou "80". */
export const money = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s === '') return 0;
  const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return Number(n);
}, z.number({ invalid_type_error: 'Valor inválido.' }).min(0, 'Não pode ser negativo.').max(9_999_999));

export const optInt = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v === null ? null : Number(v)),
    z.number().int('Use um número inteiro.').min(min).max(max).nullable());

export const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const plate = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : v),
  z.string().regex(/^[A-Z0-9]{7}$/, 'Placa deve ter 7 caracteres (ex.: ABC1D23).'),
);

export const bodyType = z.enum(['sedan', 'hatch', 'wagon', 'suv', 'pickup', 'coupe']);
export const uuid = z.string().uuid('Seleção inválida.');
export const optUuid = z.preprocess(emptyToNull, z.string().uuid().nullable());

export const customerSchema = z.object({
  name: reqText(2, 160, 'Informe o nome do cliente.'),
  phone: optText(40),
  email: z.preprocess(emptyToNull, z.string().trim().email('E-mail inválido.').max(160).nullable()),
  document: optText(30),
  notes: optText(500),
});

export const vehicleSchema = z.object({
  customer_id: uuid,
  plate,
  brand: optText(60),
  model: reqText(1, 80, 'Informe o modelo.'),
  year: optInt(1950, 2100),
  color: optText(40),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.'),
  body_type: bodyType,
  notes: optText(500),
});

export const serviceSchema = z.object({
  name: reqText(2, 120, 'Informe o nome do serviço.'),
  kind: z.enum(['standard', 'ppf']),
  default_price: money,
  part_price: money,
  est_minutes: optInt(0, 10_000),
  active: checkbox,
});

export const employeeSchema = z.object({
  name: reqText(2, 120, 'Informe o nome.'),
  role_title: optText(60),
  active: checkbox,
});

const mode = z.enum(['existing', 'new']).default('existing');

/** Campos comuns da abertura de OS. Cliente e veículo são validados em createOrder conforme o modo. */
export const newOrderSchema = z.object({
  customer_mode: mode,
  vehicle_mode: mode,
  employee_id: optUuid,
  notes: optText(500),
  partner_id: optUuid.optional(),
  seller_id: optUuid.optional(),
});

/** Cliente e veículo cadastrados na própria abertura da OS. */
export const inlineCustomerSchema = customerSchema.pick({ name: true, phone: true });
export const inlineVehicleSchema = vehicleSchema.omit({ customer_id: true, notes: true });

export const markSchema = z.object({
  part_id: z.string().min(1).max(40),
  status: z.enum(['ok', 'risco', 'riscoP', 'amassado', 'mancha', 'trinca']),
  service_id: optUuid,
  price: money,
  note: optText(300),
});

export const itemSchema = z.object({
  service_id: optUuid,
  description: reqText(1, 200, 'Descreva o item.'),
  price: money,
});

/** Quantidade decimal (até 3 casas). Aceita vírgula. */
export const decimal = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s === '') return NaN;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
}, z.number({ invalid_type_error: 'Informe um número.' }).finite().min(-9_999_999).max(9_999_999));

export const unit = z.enum(['un', 'ml', 'l', 'g', 'kg']);

export const productSchema = z.object({
  name: reqText(2, 120, 'Informe o nome do produto.'),
  sku: optText(40),
  unit,
  min_stock: decimal.refine((n) => n >= 0, 'Não pode ser negativo.'),
  cost: money,
  active: checkbox,
});

export const movementSchema = z.object({
  kind: z.enum(['in', 'out', 'adjust']),
  qty: decimal.refine((n) => n !== 0, 'A quantidade não pode ser zero.'),
  note: optText(200),
});

export const serviceProductSchema = z.object({
  product_id: uuid,
  qty: decimal.refine((n) => n > 0, 'Informe uma quantidade maior que zero.'),
});

/** PPF: Full (preço único) ou por partes (preço por parte). O total é calculado no servidor. */
export const ppfSchema = z.object({
  service_id: uuid,
  mode: z.enum(['full', 'parts']),
  full_price: money,
  parts: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9]{1,40}$/, 'Peça inválida.'),
    price: money,
  })).max(40),
});