import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // sin .env: se usan solo las variables del entorno
}

export const URL = 'https://agendamiento.dian.gov.co/';

// Textos visibles del flujo, tal como aparecen en docs/RECON.md.
export const FLOW = [
  { step: 'agendar-cita', text: 'Agendar cita' },
  { step: 'persona-natural', text: 'Persona Natural' },
  { step: 'video-atencion', text: 'Videoatención' },
  { step: 'devoluciones', text: 'Devoluciones' },
] as const;

export const NO_SLOTS_TEXT = 'No se encontraron especialidades';

// Respuesta de ValidadorValidar al pedir las colas (especialidades) del servicio.
export const API = {
  endpoint: '/Player.aspx/ValidadorValidar',
  noSlots: 'manejadorNoEncontroColas',
  slots: 'manejadorEncontroColas',
};

// Texto de páginas de bloqueo (WAF, rate limit). El widget de reCAPTCHA
// siempre está en la página, así que no cuenta como bloqueo por sí solo.
export const BLOCK_PATTERNS = [
  /access denied/i,
  /acceso denegado/i,
  /request (was )?(rejected|blocked)/i,
  /solicitud (fue )?rechazada/i,
  /too many requests/i,
  /demasiadas solicitudes/i,
];

const ACCENTS: Record<string, string> = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uú]', n: '[nñ]' };

/** Regex anclada, sin mayúsculas, tolerante a tildes, espacios y punto final. */
export function textRegex(text: string): RegExp {
  const body = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.$/, '')
    .toLowerCase()
    .split('')
    .map((c) => (c === ' ' ? '\\s*' : (ACCENTS[c] ?? c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
    .join('');
  return new RegExp(`^\\s*${body}\\.?\\s*$`, 'i');
}

const flag = z.enum(['0', '1']).default('0').transform((v) => v === '1');

const Env = z
  .object({
    NTFY_TOPIC: z.string().trim().optional(),
    NTFY_SERVER: z.string().url().default('https://ntfy.sh'),
    HEADED: flag,
    DRY_RUN: flag,
    NOTIFY_TEST: flag,
    STEP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    STATE_PATH: z.string().default('.state/state.json'),
    OUT_DIR: z.string().default('out'),
    GITHUB_SERVER_URL: z.string().optional(),
    GITHUB_REPOSITORY: z.string().optional(),
    GITHUB_RUN_ID: z.string().optional(),
  })
  .refine((e) => e.DRY_RUN || !!e.NTFY_TOPIC, {
    message: 'NTFY_TOPIC es obligatorio salvo con DRY_RUN=1',
    path: ['NTFY_TOPIC'],
  });

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = Env.parse(env);
  const runUrl =
    e.GITHUB_SERVER_URL && e.GITHUB_REPOSITORY && e.GITHUB_RUN_ID
      ? `${e.GITHUB_SERVER_URL}/${e.GITHUB_REPOSITORY}/actions/runs/${e.GITHUB_RUN_ID}`
      : undefined;
  return {
    ntfyTopic: e.NTFY_TOPIC ?? '',
    ntfyServer: e.NTFY_SERVER,
    headed: e.HEADED,
    dryRun: e.DRY_RUN,
    notifyTest: e.NOTIFY_TEST,
    stepTimeoutMs: e.STEP_TIMEOUT_MS,
    statePath: e.STATE_PATH,
    outDir: e.OUT_DIR,
    runUrl,
  };
}
