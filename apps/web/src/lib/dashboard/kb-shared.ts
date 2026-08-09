import type { CategoriaTicket, TierSoporte, TipoTicket } from './tickets-shared';

export type AudienciaKb = 'cliente' | 'agente_l1' | 'agente_l2_l3' | 'admin';

export interface KbArticleSummary {
  id: string;
  slug: string;
  titulo: string;
  resumen: string | null;
  categoria: CategoriaTicket | null;
  tipo_aplica: ReadonlyArray<TipoTicket>;
  audiencia: ReadonlyArray<AudienciaKb>;
  tier_minimo: TierSoporte;
  publicado: boolean;
  view_count: number;
  helpful_count: number;
  updated_at: string;
}

export interface KbArticleFull extends KbArticleSummary {
  contenido_md: string;
  version: number;
  publicado_en: string | null;
}

export const AUDIENCIA_LABEL: Record<AudienciaKb, string> = {
  cliente: 'Cliente final',
  agente_l1: 'Agente L1',
  agente_l2_l3: 'Agente L2 / L3',
  admin: 'Administración',
};
