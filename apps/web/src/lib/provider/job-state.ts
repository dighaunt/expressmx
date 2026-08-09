export interface ChecklistState {
  pin_cliente_validated_at: string | null;
  foto_antes_done_at: string | null;
  diagnostico_done_at: string | null;
  reparacion_done_at: string | null;
  foto_despues_done_at: string | null;
  pin_prestador_confirmed_at: string | null;
  cronometro_running: boolean;
  cronometro_acumulado_seg: number;
  cronometro_iniciado_en: string | null;
  pin_cliente_intentos: number;
  pin_prestador_intentos: number;
}

const EMPTY: ChecklistState = {
  pin_cliente_validated_at: null,
  foto_antes_done_at: null,
  diagnostico_done_at: null,
  reparacion_done_at: null,
  foto_despues_done_at: null,
  pin_prestador_confirmed_at: null,
  cronometro_running: false,
  cronometro_acumulado_seg: 0,
  cronometro_iniciado_en: null,
  pin_cliente_intentos: 0,
  pin_prestador_intentos: 0,
};

export function parseChecklistState(raw: string | null): ChecklistState {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    return {
      ...EMPTY,
      ...parsed,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function serializeChecklistState(state: ChecklistState): string {
  return JSON.stringify(state);
}

export interface CronometroComputed {
  segundos: number;
  corriendo: boolean;
}

export function computeCronometro(state: ChecklistState): CronometroComputed {
  if (!state.cronometro_running || !state.cronometro_iniciado_en) {
    return { segundos: state.cronometro_acumulado_seg, corriendo: state.cronometro_running };
  }
  const start = new Date(state.cronometro_iniciado_en).getTime();
  const elapsedSeg = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return {
    segundos: state.cronometro_acumulado_seg + elapsedSeg,
    corriendo: true,
  };
}

export function pauseCronometro(state: ChecklistState): ChecklistState {
  if (!state.cronometro_running) return state;
  const computed = computeCronometro(state);
  return {
    ...state,
    cronometro_running: false,
    cronometro_acumulado_seg: computed.segundos,
    cronometro_iniciado_en: null,
  };
}

export function resumeCronometro(state: ChecklistState): ChecklistState {
  if (state.cronometro_running) return state;
  return {
    ...state,
    cronometro_running: true,
    cronometro_iniciado_en: new Date().toISOString(),
  };
}

export function freezeCronometroForCompletion(state: ChecklistState): ChecklistState {
  return pauseCronometro(state);
}
