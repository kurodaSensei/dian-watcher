import type { Notification } from '../policy.js';

export async function notifyConsole(n: Notification): Promise<void> {
  console.log(`[notificación p${n.priority}] ${n.title}\n${n.message}`);
}
