import type { Status } from './probe/types.js';
import type { State } from './state.js';

export type Notification = {
  title: string;
  message: string;
  priority: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  click?: string;
};

export type Decision = { notification: Notification | null; state: State };

const HOUR = 3_600_000;
const FAILURE_THRESHOLD = 2;
const FAILURE_THROTTLE = 24 * HOUR;
const HEARTBEAT_MIN_GAP = 6 * 24 * HOUR;
const BOGOTA_OFFSET = -5 * HOUR; // Colombia no tiene horario de verano

const since = (iso: string | null, now: Date) => (iso ? now.getTime() - Date.parse(iso) : Infinity);

const isMondayInBogota = (now: Date) => new Date(now.getTime() + BOGOTA_OFFSET).getUTCDay() === 1;

export function decide(status: Status, prev: State, now: Date, runUrl?: string): Decision {
  const nowIso = now.toISOString();

  if (status.kind === 'ERROR' || status.kind === 'BLOCKED') {
    const failures = prev.consecutiveFailures + 1;
    const state = { ...prev, consecutiveFailures: failures };
    if (failures < FAILURE_THRESHOLD || since(prev.lastFailureNotifiedAt, now) < FAILURE_THROTTLE) {
      return { notification: null, state };
    }
    const what =
      status.kind === 'BLOCKED' ? `Bloqueado: ${status.reason}` : `Falló el paso "${status.step}": ${status.message}`;
    return {
      notification: {
        title: 'DIAN watcher: fallando',
        message: `${what}\n${failures} corridas seguidas con fallo.${runUrl ? `\nRun: ${runUrl}` : ''}`,
        priority: 2,
        tags: ['warning'],
        ...(runUrl ? { click: runUrl } : {}),
      },
      state: { ...state, lastFailureNotifiedAt: nowIso },
    };
  }

  const changed = prev.lastStatus !== status.kind;
  const state: State = {
    ...prev,
    lastStatus: status.kind,
    lastChangeAt: changed ? nowIso : prev.lastChangeAt,
    consecutiveFailures: 0,
    lastFailureNotifiedAt: null,
  };

  if (status.kind === 'AVAILABLE') {
    return {
      notification: {
        title: '¡Hay citas de Devoluciones en la DIAN!',
        message: `${status.detail ? `Especialidades: ${status.detail}\n` : ''}Agenda ya: https://agendamiento.dian.gov.co/`,
        priority: 5,
        tags: ['rotating_light'],
        click: 'https://agendamiento.dian.gov.co/',
      },
      state,
    };
  }

  if (prev.lastStatus === 'AVAILABLE') {
    return {
      notification: { title: 'Se acabaron las citas', message: 'Ya no hay especialidades de Devoluciones.', priority: 3, tags: ['hourglass'] },
      state,
    };
  }

  // Solo se avisa la recuperación si antes se avisó el fallo.
  if (prev.lastFailureNotifiedAt) {
    return {
      notification: { title: 'DIAN watcher operativo de nuevo', message: 'La última corrida funcionó (sin citas).', priority: 1, tags: ['white_check_mark'] },
      state,
    };
  }

  if (isMondayInBogota(now) && since(prev.lastHeartbeatAt, now) >= HEARTBEAT_MIN_GAP) {
    return {
      notification: { title: 'DIAN watcher sigue vivo', message: 'Aviso semanal: todo funciona, todavía sin citas.', priority: 1, tags: ['heartbeat'] },
      state: { ...state, lastHeartbeatAt: nowIso },
    };
  }

  return { notification: null, state };
}
