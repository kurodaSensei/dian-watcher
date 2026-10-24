import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classify } from './classify.js';
import { loadConfig } from './config.js';
import { notifyConsole } from './notify/console.js';
import { notifyNtfy } from './notify/ntfy.js';
import { decide, type Notification } from './policy.js';
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

const send = (n: Notification) => (cfg.dryRun ? notifyConsole(n) : notifyNtfy(cfg, n));
const toSend: Notification[] = [];
if (cfg.notifyTest) {
  // Disparo manual para comprobar que el tópico y la app del celular están bien conectados.
  toSend.push({ title: 'Prueba del DIAN watcher', message: `Resultado de esta corrida: ${status.kind}`, priority: 3, tags: ['test_tube'] });
}
if (notification) toSend.push(notification);

let notifyError: string | undefined;
for (const n of toSend) {
  try {
    await send(n);
  } catch (e) {
    notifyError = String(e);
  }
}

await saveState(cfg.statePath, state);
await mkdir(cfg.outDir, { recursive: true });
const result = { at: new Date().toISOString(), status, notification, notifyError, state };
await writeFile(join(cfg.outDir, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status, sent: toSend.map((n) => n.title), notifyError }, null, 2));

process.exit(status.kind === 'ERROR' || status.kind === 'BLOCKED' || notifyError ? 1 : 0);
