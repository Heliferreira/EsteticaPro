import type { ZodTypeAny, z } from 'zod';

/** Estado devolvido pelas server actions de formulário (usado com useFormState). */
export type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

export function friendlyError(e: { code?: string; message: string }): string {
  switch (e.code) {
    case '23505': return 'Já existe um registro com esses dados (por exemplo, placa repetida).';
    case '23503': return 'Este registro está em uso por outro cadastro e não pode ser removido ou alterado assim.';
    case '23514': return 'Algum valor está fora do permitido.';
    case '42501': return 'Você não tem permissão para fazer isso.';
    default: return e.message || 'Algo deu errado. Tente novamente.';
  }
}

/** Valida o FormData com zod. Devolve os dados ou um FormState com os erros por campo. */
export function parseForm<S extends ZodTypeAny>(
  schema: S,
  fd: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; state: FormState } {
  const r = schema.safeParse(Object.fromEntries(fd));
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, state: { error: 'Confira os campos destacados.', fieldErrors } };
}

export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
