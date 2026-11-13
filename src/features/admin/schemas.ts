import { z } from 'zod';

export const newClientSchema = z.object({
  company_name: z.string().trim().min(2, 'Informe o nome da empresa.').max(120),
  owner_name: z.string().trim().min(2, 'Informe o nome do dono.').max(120),
  owner_email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
});

export const uuidSchema = z.string().uuid();
