import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const ESTATUS_ORDEN = [
  'solicitada',
  'asignada',
  'en_camino',
  'en_progreso',
  'completada',
  'cancelada',
] as const;

export const ESTATUS_ORDEN_PRESTADOR_UPDATE = [
  'en_camino',
  'en_progreso',
  'completada',
] as const;

export const DIA_SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const;

export const RANGO_EARNINGS = ['hoy', 'semana', 'mes', 'anio'] as const;

export const PASO_CHECKLIST = [
  'pin_cliente',
  'foto_antes',
  'diagnostico',
  'reparacion',
  'foto_despues',
  'pin_prestador',
] as const;

export const FASE_EVIDENCIA = ['antes', 'despues'] as const;

export const TIPO_DOCUMENTO = ['ine', 'curp', 'domicilio', 'certificacion'] as const;

export const mobileProviderJobsQuerySchema = paginationQuerySchema.extend({
  estatus: z.enum(ESTATUS_ORDEN).optional(),
});
export type MobileProviderJobsQuery = z.infer<typeof mobileProviderJobsQuerySchema>;

export const mobileProviderJobStatusSchema = z.object({
  estatus: z.enum(ESTATUS_ORDEN),
});
export type MobileProviderJobStatusInput = z.infer<typeof mobileProviderJobStatusSchema>;

export const mobileProviderJobStatusUpdateSchema = z.object({
  estatus: z.enum(ESTATUS_ORDEN_PRESTADOR_UPDATE),
});
export type MobileProviderJobStatusUpdateInput = z.infer<
  typeof mobileProviderJobStatusUpdateSchema
>;

export const mobileProviderLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().nullable().optional(),
  timestamp: z.string().datetime().optional(),
});
export type MobileProviderLocationInput = z.infer<typeof mobileProviderLocationSchema>;

export const mobileProviderEarningsQuerySchema = z.object({
  rango: z.enum(RANGO_EARNINGS).default('semana'),
});
export type MobileProviderEarningsQuery = z.infer<typeof mobileProviderEarningsQuerySchema>;

export const mobileProviderBankAccountSchema = z.object({
  titular: z.string().trim().min(5, 'El titular debe tener al menos 5 caracteres').max(120),
  clabe: z
    .string()
    .trim()
    .regex(/^\d{18}$/, 'La CLABE debe tener 18 dígitos'),
});
export type MobileProviderBankAccountInput = z.infer<typeof mobileProviderBankAccountSchema>;

export const mobileProviderBankAccountHolderSchema = mobileProviderBankAccountSchema.pick({
  titular: true,
});
export type MobileProviderBankAccountHolderInput = z.infer<
  typeof mobileProviderBankAccountHolderSchema
>;

export const mobileProviderAvailabilityStateSchema = z.object({
  online: z.boolean(),
});
export type MobileProviderAvailabilityStateInput = z.infer<
  typeof mobileProviderAvailabilityStateSchema
>;

const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (HH:MM)');

export const mobileProviderAvailabilitySlotSchema = z.object({
  dia: z.enum(DIA_SEMANA),
  hora_inicio: horaSchema,
  hora_fin: horaSchema,
});
export type MobileProviderAvailabilitySlotInput = z.infer<
  typeof mobileProviderAvailabilitySlotSchema
>;

export const mobileProviderAvailabilityPutSchema = z.object({
  slots: z.array(mobileProviderAvailabilitySlotSchema).max(50),
});
export type MobileProviderAvailabilityPutInput = z.infer<
  typeof mobileProviderAvailabilityPutSchema
>;

export const mobileProviderServicesPutSchema = z.object({
  servicios: z
    .array(
      z.object({
        servicio_id: z.string().uuid(),
        activo: z.boolean(),
      }),
    )
    .max(80),
});
export type MobileProviderServicesPutInput = z.infer<typeof mobileProviderServicesPutSchema>;

export const mobileProviderPinClienteSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN debe ser 6 dígitos'),
});
export type MobileProviderPinClienteInput = z.infer<typeof mobileProviderPinClienteSchema>;

export const mobileProviderCargoExtraSchema = z.object({
  descripcion: z.string().trim().min(4, 'Descripción muy corta').max(140),
  monto: z
    .number()
    .positive('Monto debe ser positivo')
    .max(10000, 'Monto excede el máximo permitido'),
});
export type MobileProviderCargoExtraInput = z.infer<typeof mobileProviderCargoExtraSchema>;

export const mobileProviderChecklistSchema = z.object({
  paso: z.enum(PASO_CHECKLIST),
});
export type MobileProviderChecklistInput = z.infer<typeof mobileProviderChecklistSchema>;

export const mobileProviderCronometroSchema = z.object({
  accion: z.enum(['pausar', 'reanudar']),
});
export type MobileProviderCronometroInput = z.infer<typeof mobileProviderCronometroSchema>;

export const mobileProviderEvidenciasQuerySchema = z.object({
  fase: z.enum(FASE_EVIDENCIA).optional(),
});
export type MobileProviderEvidenciasQuery = z.infer<typeof mobileProviderEvidenciasQuerySchema>;
