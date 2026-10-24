import { API, BLOCK_PATTERNS } from './config.js';
import type { CapturedResponse, ProbeOutput, Status } from './probe/types.js';

type ValidadorResult = {
  Encontrado?: boolean;
  ErrorString?: string | null;
  DetalleAdicional?: string | null;
  TotalObjetosEncontrados?: number;
  ObjetosEncontrados?: unknown;
};

/** ValidadorValidar responde `{"d":"<json como string>"}`. */
function parseValidador(r: CapturedResponse): ValidadorResult | null {
  if (!r.url.includes(API.endpoint)) return null;
  try {
    const outer: any = JSON.parse(r.body);
    const inner: any = typeof outer?.d === 'string' ? JSON.parse(outer.d) : outer?.d;
    return inner && typeof inner === 'object' ? (inner as ValidadorResult) : null;
  } catch {
    return null;
  }
}

function describeSlots(objs: unknown): string | undefined {
  const names = JSON.stringify(objs ?? null).match(/"Nombre":"([^"]+)"/g);
  if (!names?.length) return undefined;
  return [...new Set(names.map((n) => n.slice(10, -1)))].slice(0, 5).join(', ');
}

export function classify(out: ProbeOutput): Status {
  // 1. Bloqueo
  const blockedStatus = [out.mainStatus, ...out.responses.map((r) => r.status)].find((s) => s === 403 || s === 429);
  if (blockedStatus) return { kind: 'BLOCKED', reason: `HTTP ${blockedStatus}` };
  const pattern = BLOCK_PATTERNS.find((p) => p.test(out.html));
  if (pattern) return { kind: 'BLOCKED', reason: `texto de bloqueo: ${pattern.source}` };

  // 2. Excepción en un paso
  if (out.failure) return { kind: 'ERROR', step: out.failure.step, message: out.failure.message };

  // La última respuesta de colas es la que decide (la del clic en Devoluciones).
  const colas = out.responses
    .map(parseValidador)
    .filter((v): v is ValidadorResult => !!v && /EncontroColas$/.test(v.DetalleAdicional ?? ''))
    .at(-1);

  if (colas?.ErrorString) return { kind: 'ERROR', step: 'api', message: colas.ErrorString };

  // 3. Sin especialidades
  if (colas?.DetalleAdicional === API.noSlots || out.modalVisible) return { kind: 'NO_SLOTS' };

  // 4. Evidencia positiva
  if (colas?.DetalleAdicional === API.slots && colas.Encontrado && (colas.TotalObjetosEncontrados ?? 0) > 0) {
    const detail = describeSlots(colas.ObjetosEncontrados);
    return detail ? { kind: 'AVAILABLE', detail } : { kind: 'AVAILABLE' };
  }

  // 5. Ni positivo ni negativo
  return { kind: 'ERROR', step: 'classify', message: 'estado ambiguo: ni modal ni especialidades en la respuesta' };
}
