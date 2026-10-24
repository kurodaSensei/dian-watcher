import type { Config } from '../config.js';
import type { Notification } from '../policy.js';

export async function notifyNtfy(cfg: Config, n: Notification): Promise<void> {
  const res = await fetch(cfg.ntfyServer, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: cfg.ntfyTopic, ...n }),
  });
  if (!res.ok) throw new Error(`ntfy respondió ${res.status}: ${await res.text()}`);
}
