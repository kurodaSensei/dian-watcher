import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { API, FLOW, NO_SLOTS_TEXT, URL, textRegex, type Config } from '../config.js';
import type { CapturedResponse, ProbeOutput } from './types.js';

const BODY_LIMIT = 50_000;

/**
 * El sitio no usa roles accesibles (ver docs/RECON.md): se busca por texto exacto.
 * Hay copias ocultas de algunos textos, por eso solo cuenta el primero visible.
 */
const byText = (page: Page, text: string) => page.getByText(textRegex(text)).filter({ visible: true }).first();

export async function probe(cfg: Config): Promise<ProbeOutput> {
  const browser = await chromium.launch({ headless: !cfg.headed });
  const context = await browser.newContext({ locale: 'es-CO', timezoneId: 'America/Bogota' });
  const page = await context.newPage();
  page.setDefaultTimeout(cfg.stepTimeoutMs);

  const responses: CapturedResponse[] = [];
  const pending: Promise<void>[] = [];
  page.on('response', (res) => {
    if (!res.url().includes('/Player.aspx/')) return;
    pending.push(
      res
        .text()
        .catch(() => '')
        .then((body) => {
          responses.push({ method: res.request().method(), url: res.url(), status: res.status(), body: body.slice(0, BODY_LIMIT) });
        }),
    );
  });

  let mainStatus: number | null = null;
  let modalVisible = false;
  let failure: ProbeOutput['failure'];
  let step = 'open';

  try {
    const res = await page.goto(URL, { waitUntil: 'domcontentloaded' });
    mainStatus = res?.status() ?? null;

    for (const s of FLOW) {
      step = s.step;
      if (s === FLOW.at(-1)) {
        // El clic en Devoluciones dispara la consulta de colas que decide el resultado.
        await Promise.all([
          page.waitForResponse((r) => r.url().includes(API.endpoint)),
          byText(page, s.text).click(),
        ]);
      } else {
        await byText(page, s.text).click();
      }
    }

    step = 'resultado';
    const modal = page.getByText(NO_SLOTS_TEXT, { exact: false }).first();
    await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    modalVisible = await modal.isVisible();
  } catch (e) {
    failure = { step, message: e instanceof Error ? e.message.split('\n')[0]! : String(e) };
  }

  await Promise.all(pending);
  const html = await page.content().catch(() => '');

  await mkdir(cfg.outDir, { recursive: true });
  await page.screenshot({ path: join(cfg.outDir, 'final.png'), fullPage: true }).catch(() => {});
  await writeFile(join(cfg.outDir, 'final.html'), html);
  await writeFile(
    join(cfg.outDir, 'api.json'),
    JSON.stringify(responses.map((r) => ({ ...r, body: r.body.slice(0, 5000) })), null, 2),
  );
  await browser.close();

  return { mainStatus, html, modalVisible, responses, ...(failure ? { failure } : {}) };
}
