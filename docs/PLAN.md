# Plan de construcción con Claude Code

Cada fase es una sesión (o un `/clear`) de Claude Code. Copia el prompt,
revisa el resultado contra los criterios de aceptación y haz commit antes
de pasar a la siguiente.

Sugerencia: usa **Plan mode** (Shift+Tab) en las fases 1, 2 y 4 para
aprobar el plan antes de que escriba código.

---

## Fase 0: Recon del sitio

**Herramienta:** Playwright MCP (`claude mcp add playwright npx @playwright/mcp@latest`)
o Claude in Chrome.

**Prompt:**
> Usando el navegador, abre https://agendamiento.dian.gov.co/ y recorre:
> Agendar cita → Persona natural → Video atención → Devoluciones. No
> envíes ningún formulario más allá de ese punto. Documenta en
> docs/RECON.md: (1) para cada paso, el texto exacto del elemento
> clickeable y su rol accesible; (2) el texto exacto del modal de "sin
> especialidades" y cómo se cierra; (3) las requests XHR/fetch que se
> disparan en cada paso (método, URL, payload, headers relevantes y forma
> de la respuesta, en especial la que alimenta el modal); (4) si hay
> captcha, cookies de sesión o tokens. Guarda el HTML del estado final en
> test/fixtures/no-slots.html.

**Aceptación:**
- [ ] `docs/RECON.md` con los 4 puntos
- [ ] Fixture `no-slots.html` guardado
- [ ] Decisión anotada: ¿el endpoint es llamable sin navegador? (sí/no/no sé)

---

## Fase 1: Scaffold + núcleo puro

**Prompt:**
> Lee docs/ARCHITECTURE.md y docs/RECON.md. Crea el scaffold del proyecto
> (package.json con los scripts de CLAUDE.md, tsconfig estricto, vitest,
> zod, tsx, playwright, .gitignore, .env.example). Implementa solo los
> tipos (`src/probe/types.ts`), `src/config.ts`, `src/classify.ts`,
> `src/policy.ts` y `src/state.ts`, con tests. Todavía nada de Playwright
> ni de red. Para `classify` usa test/fixtures/no-slots.html y crea
> fixtures sintéticos para AVAILABLE, BLOCKED y "ambiguo".

**Aceptación:**
- [ ] `npm test` y `npm run typecheck` en verde
- [ ] Tests de `policy` cubren cada fila de la tabla de notificación
- [ ] `classify` devuelve `ERROR` en el caso ambiguo (sin evidencia)

---

## Fase 2: Probe con navegador + notificador

**Prompt:**
> Implementa `src/probe/browser.ts` con Playwright siguiendo el recon:
> clic por texto visible usando los textos de config, captura de
> respuestas JSON, y evidencia en out/ (final.png, final.html, api.json).
> Cada paso con nombre para que el ERROR diga dónde falló. Implementa
> `src/notify/ntfy.ts`, `src/notify/console.ts` y el orquestador
> `src/index.ts` con los exit codes de la arquitectura. Luego corre
> `npm run check:dry` una vez contra el sitio real y muéstrame result.json.

**Aceptación:**
- [ ] `check:dry` contra el sitio real da `NO_SLOTS` (hoy no hay citas)
- [ ] Forzando un texto de paso inexistente en config → `ERROR` con el nombre del paso
- [ ] Con `NTFY_TOPIC` real y un AVAILABLE simulado, llega el push al celular

---

## Fase 3: GitHub Actions

**Prompt:**
> Crea .github/workflows/watch.yml: cron `7 */4 * * *` más
> workflow_dispatch; Node 20 con cache de npm; cache del navegador de
> Playwright; restore/save de .state/ con actions/cache (key con run_id,
> restore-keys por prefijo, save con `if: always()`); `npm run check` con
> el secret NTFY_TOPIC; upload-artifact de out/ con 7 días de retención.
> `timeout-minutes: 10` y `concurrency` para que no se pisen corridas.

**Aceptación:**
- [ ] Corrida manual verde y artifact con evidencia
- [ ] La segunda corrida restaura el state.json de la primera
- [ ] Secret `NTFY_TOPIC` configurado (lo haces tú en Settings)

---

## Fase 4 (opcional): Probe por API

Solo si el recon dijo que el endpoint es llamable sin navegador.

**Prompt:**
> Implementa `src/probe/api.ts` replicando la request de docs/RECON.md
> con fetch. Debe devolver el mismo `ProbeOutput` que el probe de
> navegador para que `classify` no cambie. Agrega un fixture JSON por
> cada estado. Selecciónalo con PROBE=api y compara ambos probes en una
> corrida real.

**Aceptación:**
- [ ] Ambos probes clasifican igual en la misma corrida
- [ ] El workflow puede saltarse la instalación de Playwright cuando `PROBE=api`

---

## Fase 5: Endurecimiento

**Prompt:**
> Agrega heartbeat semanal (lunes), mensaje de recuperación tras errores,
> link al run de Actions en las notificaciones de error y un README con
> setup en 5 pasos (app ntfy, tópico, secret, dispatch manual, cómo
> regenerar fixtures desde out/final.html).

**Aceptación:**
- [ ] README probado por alguien que no seas tú (o tú en limpio)
- [ ] Simular 2 fallos seguidos → 1 solo aviso; un tercero en < 24 h → ninguno

---

## Opcional: comandos de Claude Code

Puedes crear `.claude/commands/` con:
- `recon.md`: el prompt de la Fase 0 para re-hacer el recon cuando la DIAN cambie la página
- `fix-selectors.md`: "lee out/final.html del último artifact fallido, compáralo con docs/RECON.md, actualiza los textos en config y el fixture, y corre los tests"
