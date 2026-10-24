import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type State = {
  /** Último resultado definitivo (AVAILABLE o NO_SLOTS); los fallos no lo pisan. */
  lastStatus: 'AVAILABLE' | 'NO_SLOTS' | null;
  lastChangeAt: string | null;
  consecutiveFailures: number;
  lastFailureNotifiedAt: string | null;
  lastHeartbeatAt: string | null;
};

export const EMPTY_STATE: State = {
  lastStatus: null,
  lastChangeAt: null,
  consecutiveFailures: 0,
  lastFailureNotifiedAt: null,
  lastHeartbeatAt: null,
};

/** Si el archivo no existe o está corrupto se arranca en limpio. */
export async function loadState(path: string): Promise<State> {
  try {
    return { ...EMPTY_STATE, ...JSON.parse(await readFile(path, 'utf8')) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export async function saveState(path: string, state: State): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n');
}
