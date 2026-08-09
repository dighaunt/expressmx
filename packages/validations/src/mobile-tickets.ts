import { z } from 'zod';

export const TICKET_CATEGORIAS = [
  'cobro_incorrecto',
  'no_show',
  'dano_propiedad',
  'queja_servicio',
  'otro',
] as const;
export type TicketCategoria = (typeof TICKET_CATEGORIAS)[number];

export const REEMBOLSO_MOTIVOS = [
  'cobro_duplicado',
  'monto_incorrecto',
  'servicio_no_recibido',
  'cargo_no_reconocido',
] as const;
export type ReembolsoMotivo = (typeof REEMBOLSO_MOTIVOS)[number];

export const mobileTicketRefundDiagnosisSchema = z.object({
  tipo: z.literal('reembolso'),
  motivo: z.enum(REEMBOLSO_MOTIVOS),
  elegibilidad: z.enum(['candidato', 'revision_manual']),
});

export const mobileTicketCreateSchema = z.object({
  categoria: z.enum(TICKET_CATEGORIAS),
  asunto: z.string().trim().min(5, 'Resume en una línea qué pasó').max(120),
  descripcion: z
    .string()
    .trim()
    .min(15, 'Cuéntanos un poco más para ayudarte mejor')
    .max(2000),
  orden_id: z.string().uuid().optional(),
  diagnostico: mobileTicketRefundDiagnosisSchema.optional(),
});

export type MobileTicketCreateInput = z.infer<typeof mobileTicketCreateSchema>;

export const mobileTicketResponderSchema = z.object({
  contenido: z.string().trim().min(1, 'Escribe tu respuesta').max(5000),
});

export type MobileTicketResponderInput = z.infer<typeof mobileTicketResponderSchema>;

export const mobileKbHelpfulSchema = z.object({
  helpful: z.boolean(),
  deflected: z.boolean().optional(),
});

export type MobileKbHelpfulInput = z.infer<typeof mobileKbHelpfulSchema>;
