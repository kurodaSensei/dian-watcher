import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_STATE, loadState, saveState } from '../src/state.js';

describe('state', () => {
  it('ida y vuelta, creando la carpeta', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'dian-')), 'nested', 'state.json');
    const st = { ...EMPTY_STATE, lastStatus: 'NO_SLOTS' as const, consecutiveFailures: 2 };
    await saveState(path, st);
    expect(await loadState(path)).toEqual(st);
  });

  it('arranca en limpio si no existe o está corrupto', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dian-'));
    expect(await loadState(join(dir, 'nope.json'))).toEqual(EMPTY_STATE);
    await writeFile(join(dir, 'bad.json'), '{oops');
    expect(await loadState(join(dir, 'bad.json'))).toEqual(EMPTY_STATE);
  });
});
