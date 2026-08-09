

BEGIN;

INSERT INTO public.config_sistema (clave, valor, descripcion)
VALUES (
  'credito_factor_max_servicio',
  '1.0',
  'Multiplo maximo del valor del servicio en disputa que puede salir como credito'
)
ON CONFLICT (clave) DO NOTHING;

DELETE FROM public.config_sistema WHERE clave = 'tope_reembolso_agente';

COMMIT;
