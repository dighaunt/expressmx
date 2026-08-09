import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from '@expressmx/validations';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mobileRegisterSchema,
  mobileServicesQuerySchema,
  mobileOrdersListQuerySchema,
  mobileCreateOrderSchema,
  mobileNotificationsQuerySchema,
  mobileProviderJobsQuerySchema,
  mobileProviderJobStatusSchema,
  idParamSchema,
} from '@expressmx/validations';

extendZodWithOpenApi(z);

const publicServerUrl =
  process.env.OPENAPI_SERVER_URL ??
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  'https://expressmx.com';

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

const dataResponse = <T extends z.ZodTypeAny>(data: T) => z.object({ data });

const paginationSchema = z.object({
  cursor: z.string().nullable(),
  limit: z.number(),
  hasMore: z.boolean(),
});
const pageResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), pagination: paginationSchema });

const sessionUserSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  apellidos: z.string(),
  email: z.string().email(),
  rol: z.enum(['cliente', 'prestador', 'admin']),
  avatar_url: z.string().nullable(),
});

const orderListItemSchema = z.object({
  id: z.string().uuid(),
  estatus: z.string(),
  created_at: z.string(),
  fecha_creacion: z.string(),
  servicio_nombre: z.string(),
  prestador_nombre: z.string().nullable(),
  total: z.number(),
});

const notificationItemSchema = z.object({
  id: z.string().uuid(),
  tipo: z.string(),
  titulo: z.string(),
  cuerpo: z.string().nullable(),
  canal: z.string(),
  leida: z.boolean(),
  created_at: z.string(),
});

const mobileBannerSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  imagen_url: z.string().url(),
  url_destino: z.string().url().nullable(),
  segmento: z.enum(['todos', 'nuevos', 'recurrentes']),
});

const providerJobItemSchema = z.object({
  id: z.string().uuid(),
  estatus: z.string(),
  created_at: z.string(),
  servicio_nombre: z.string(),
  cliente_nombre: z.string(),
  direccion: z.string().nullable(),
  fecha_programada: z.string().nullable(),
  total: z.number(),
});

const errorResponses = {
  400: { description: 'Solicitud inválida', content: { 'application/json': { schema: errorSchema } } },
  401: { description: 'No autenticado', content: { 'application/json': { schema: errorSchema } } },
  403: { description: 'Acceso no autorizado', content: { 'application/json': { schema: errorSchema } } },
  404: { description: 'No encontrado', content: { 'application/json': { schema: errorSchema } } },
  422: { description: 'Datos inválidos', content: { 'application/json': { schema: errorSchema } } },
};

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['auth'],
  summary: 'Iniciar sesión',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    200: {
      description: 'Login exitoso',
      content: { 'application/json': { schema: dataResponse(z.object({ token: z.string(), usuario: sessionUserSchema })) } },
    },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['auth'],
  summary: 'Cerrar sesión',
  responses: {
    200: { description: 'Logout', content: { 'application/json': { schema: dataResponse(z.object({ ok: z.literal(true) })) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/forgot-password',
  tags: ['auth'],
  summary: 'Solicitar recuperación de contraseña',
  request: { body: { content: { 'application/json': { schema: forgotPasswordSchema } } } },
  responses: {
    200: { description: 'Email enviado si existe', content: { 'application/json': { schema: dataResponse(z.object({ message: z.string() })) } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/reset-password',
  tags: ['auth'],
  summary: 'Resetear contraseña',
  request: { body: { content: { 'application/json': { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: 'Contraseña actualizada', content: { 'application/json': { schema: dataResponse(z.object({ message: z.string() })) } } },
    400: errorResponses[400],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['auth'],
  summary: 'Sesión actual',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Usuario autenticado', content: { 'application/json': { schema: dataResponse(sessionUserSchema) } } },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/mobile/register',
  tags: ['auth', 'mobile'],
  summary: 'Registrar cliente o prestador',
  request: { body: { content: { 'application/json': { schema: mobileRegisterSchema } } } },
  responses: {
    201: { description: 'Cuenta creada', content: { 'application/json': { schema: dataResponse(z.object({ id: z.string().uuid() })) } } },
    409: { description: 'Email ya registrado', content: { 'application/json': { schema: errorSchema } } },
    422: errorResponses[422],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/services',
  tags: ['mobile', 'servicios'],
  summary: 'Listar servicios disponibles',
  request: { query: mobileServicesQuerySchema },
  responses: {
    200: { description: 'Catálogo', content: { 'application/json': { schema: z.object({ servicios: z.array(z.unknown()) }) } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/services/{id}',
  tags: ['mobile', 'servicios'],
  summary: 'Detalle de servicio',
  request: { params: idParamSchema },
  responses: {
    200: { description: 'Servicio', content: { 'application/json': { schema: z.object({ servicio: z.unknown() }) } } },
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/banners',
  tags: ['mobile', 'marketing'],
  summary: 'Listar banners vigentes para la app cliente',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Banners vigentes segmentados', content: { 'application/json': { schema: dataResponse(z.array(mobileBannerSchema)) } } },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/orders',
  tags: ['mobile', 'orders'],
  summary: 'Listar órdenes del cliente (paginadas)',
  security: [{ bearerAuth: [] }],
  request: { query: mobileOrdersListQuerySchema },
  responses: {
    200: { description: 'Página', content: { 'application/json': { schema: pageResponse(orderListItemSchema) } } },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/mobile/orders',
  tags: ['mobile', 'orders'],
  summary: 'Crear orden',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: mobileCreateOrderSchema } } } },
  responses: {
    201: { description: 'Orden creada', content: { 'application/json': { schema: dataResponse(z.object({ id: z.string().uuid() })) } } },
    401: errorResponses[401],
    404: errorResponses[404],
    422: errorResponses[422],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/orders/{id}',
  tags: ['mobile', 'orders'],
  summary: 'Detalle de orden',
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: {
    200: { description: 'Orden', content: { 'application/json': { schema: z.object({ orden: z.unknown() }) } } },
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/notifications',
  tags: ['mobile', 'notifications'],
  summary: 'Listar notificaciones (paginadas)',
  security: [{ bearerAuth: [] }],
  request: { query: mobileNotificationsQuerySchema },
  responses: {
    200: { description: 'Página', content: { 'application/json': { schema: pageResponse(notificationItemSchema) } } },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/provider/jobs',
  tags: ['mobile', 'provider'],
  summary: 'Listar trabajos asignados al prestador (paginados)',
  security: [{ bearerAuth: [] }],
  request: { query: mobileProviderJobsQuerySchema },
  responses: {
    200: { description: 'Página', content: { 'application/json': { schema: pageResponse(providerJobItemSchema) } } },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/mobile/provider/jobs/{id}',
  tags: ['mobile', 'provider'],
  summary: 'Detalle de trabajo',
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: {
    200: { description: 'Trabajo', content: { 'application/json': { schema: z.object({ orden: z.unknown() }) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/mobile/provider/jobs/{id}/status',
  tags: ['mobile', 'provider'],
  summary: 'Actualizar estatus de trabajo',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: mobileProviderJobStatusSchema } } },
  },
  responses: {
    200: { description: 'Estatus actualizado', content: { 'application/json': { schema: z.object({ orden: z.unknown() }) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'ExpressMX API',
    version: '1.0.0',
    description: 'Backend versionado /api/v1 para apps móviles ExpressMX',
  },
  servers: [
    { url: publicServerUrl.replace(/\/+$/, ''), description: 'Producción' },
  ],
});

const outPath = resolve(process.cwd(), 'openapi.json');
writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');
console.log(`OpenAPI written to ${outPath}`);
