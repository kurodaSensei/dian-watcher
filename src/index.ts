import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classify } from './classify.js';
import { loadConfig } from './config.js';
import { notifyConsole } from './notify/console.js';
import { notifyNtfy } from './notify/ntfy.js';
import { decide } from './policy.js';
import { probe } from './probe/browser.js';
import type { ProbeOutput } from './probe/types.js';
import { loadState, saveState } from './state.js';

const cfg = loadConfig();
const prev = await loadState(cfg.statePath);

let out: ProbeOutput;
try {
  out = await probe(cfg);
} catch (e) {
  // El navegador ni arrancó: se trata como un fallo más del paso "browser".
  out = { mainStatus: null, html: '', modalVisible: false, responses: [], failure: { step: 'browser', message: String(e) } };
}

const status = classify(out);
const { notification, state } = decide(status, prev, new Date(), cfg.runUrl);

let notifyError: string | undefined;
if (notification) {
  try {
    await (cfg.dryRun ? notifyConsole(notification) : notifyNtfy(cfg, notification));
  } catch (e) {
    notifyError = String(e);
  }
}

await saveState(cfg.statePath, state);
await mkdir(cfg.outDir, { recursive: true });
const result = { at: new Date().toISOString(), status, notification, notifyError, state };
await writeFile(join(cfg.outDir, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status, notified: !!notification, notifyError }, null, 2));

process.exit(status.kind === 'ERROR' || status.kind === 'BLOCKED' || notifyError ? 1 : 0);
