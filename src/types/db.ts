// Tipos das tabelas usados no app. Quando o projeto estiver ligado ao Supabase,
// dá para gerar estes tipos automaticamente com `supabase gen types typescript`.

export type Role = 'owner' | 'manager' | 'operator';
export type BodyType = 'sedan' | 'hatch' | 'wagon' | 'suv' | 'pickup' | 'coupe';
export type OsStatus = 'open' | 'in_progress' | 'done' | 'delivered' | 'cancelled';
export type MarkStatus = 'ok' | 'risco' | 'riscoP' | 'amassado' | 'mancha' | 'trinca';

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  company_id: string;
  customer_id: string;
  plate: string;
  brand: string | null;
  model: string;
  year: number | null;
  color: string | null;
  color_hex: string;
  body_type: BodyType;
  notes: string | null;
}

export interface Service {
  id: string;
  company_id: string;
  name: string;
  default_price: number;
  est_minutes: number | null;
  active: boolean;
  kind: 'standard' | 'ppf';
  part_price: number;
}

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  role_title: string | null;
  active: boolean;
}

export interface WorkOrder {
  id: string;
  company_id: string;
  number: number;
  customer_id: string;
  vehicle_id: string;
  employee_id: string | null;
  status: OsStatus;
  entry_at: string;
  notes: string | null;
}

export interface OsListRow {
  id: string;
  number: number;
  status: OsStatus;
  entry_at: string;
  customer_id: string;
  vehicle_id: string;
  employee_id: string | null;
  customer_name: string;
  plate: string;
  brand: string | null;
  model: string;
  employee_name: string | null;
  total: number;
}

export interface WorkOrderMark {
  id: string;
  work_order_id: string;
  part_id: string;
  status: MarkStatus;
  service_id: string | null;
  price: number;
  note: string | null;
}

/** Aplicação de PPF: carro completo (full) ou só algumas partes, cada uma com seu preço. */
export interface PpfData {
  mode: 'full' | 'parts';
  parts: Array<{ id: string; price: number }>;
}

export interface WorkOrderItem {
  id: string;
  work_order_id: string;
  service_id: string | null;
  description: string;
  price: number;
  ppf: PpfData | null;
}

export type Unit = 'un' | 'ml' | 'l' | 'g' | 'kg';
export type MovementKind = 'in' | 'out' | 'adjust' | 'os';

export interface ProductStockRow {
  id: string;
  name: string;
  sku: string | null;
  unit: Unit;
  min_stock: number;
  cost: number;
  active: boolean;
  stock: number;
  low: boolean;
}

export interface StockMovement {
  id: string;
  product_id: string;
  kind: MovementKind;
  qty: number;
  note: string | null;
  work_order_id: string | null;
  created_at: string;
}

export interface ServiceProduct {
  id: string;
  service_id: string;
  product_id: string;
  qty: number;
}

// ---------------------------------------------------------------- parceiros, comissões e relatórios
export type CommissionMode = 'pct' | 'val';
export type SellerFrom = 'estetica' | 'parceiro';

export interface Partner {
  id: string;
  name: string;
  pct_default: number;
  notes: string | null;
}

export interface Seller {
  id: string;
  partner_id: string;
  name: string;
  pct_default: number;
}

export interface OrderCommission {
  work_order_id: string;
  partner_id: string | null;
  seller_id: string | null;
  charged: number | null;
  partner_mode: CommissionMode;
  partner_value: number | null;
  seller_mode: CommissionMode;
  seller_value: number | null;
  /** De quem sai a comissão do vendedor: da parte da estética ou da parte do parceiro. */
  seller_from: SellerFrom;
  report_id: string | null;
}

export interface ReportRow {
  order_id: string;
  number: number;
  date: string; // YYYY-MM-DD
  vehicle: string;
  plate: string;
  body_type: BodyType;
  // status e price só existem em relatórios gerados depois da migration 6 (os congelados antigos não têm).
  marks: Array<{ part: string; service: string | null; status?: string; price?: number }>;
  items: Array<{ description: string; service: string | null; ppf: PpfData | null; price?: number }>;
  charged: number;
  /** Parte do parceiro (% sobre o total), antes de descontar o vendedor. Só nos relatórios novos. */
  partner_share?: number;
  /** O que o parceiro recebe de fato (já sem a comissão do vendedor, se for ele quem paga). */
  partner_amount: number;
  seller_id: string | null;
  seller: string | null;
  seller_amount: number;
  /** De quem saiu a comissão do vendedor. Relatórios antigos não têm: valem como "estetica". */
  seller_from?: SellerFrom;
  /** O que fica com a estética. */
  net: number;
  frozen: boolean;
}

export interface ReportData {
  partner_id: string;
  partner: string;
  from: string;
  to: string;
  rows: ReportRow[];
  totals: { charged: number; partner_amount: number; seller_amount: number; net: number; orders: number };
}

export interface CommissionReport {
  id: string;
  number: number;
  partner_id: string;
  period_from: string;
  period_to: string;
  snapshot: ReportData;
  created_at: string;
}