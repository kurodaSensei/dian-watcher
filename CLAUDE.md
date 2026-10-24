# DIAN watcher

Watcher que revisa cada 4 h si hay citas de "Devoluciones" (video
atención, persona natural) en https://agendamiento.dian.gov.co/ y avisa
por ntfy. La arquitectura completa está en @docs/ARCHITECTURE.md y el plan
por fases en @docs/PLAN.md. Lee ambos antes de cambiar la estructura.

## Comandos

- `npm run check`: una corrida real (usa `.env` si existe)
- `npm run check:headed`: igual, pero con el navegador visible
- `npm run check:dry`: corrida real sin notificar (ConsoleNotifier)
- `npm test`: vitest (classify, policy, state)
- `npm run typecheck`: `tsc --noEmit`

## Reglas

- TypeScript estricto, ESM, Node 24 (LTS; Node 20 llegó a EOL en abril 2026). Sin `any` salvo en el parseo de respuestas externas.
- `classify.ts` y `policy.ts` son **funciones puras**: nada de I/O, fechas
  solo inyectadas (`now: Date` como parámetro).
- Todo cambio en `classify` o `policy` lleva test con fixture en `test/fixtures/`.
- Los tests **nunca** golpean el sitio real. Solo `npm run check*` lo hace.
- No subas la frecuencia del cron por debajo de 1 hora.
- Selectores por texto visible, tolerantes a tildes, mayúsculas y punto final.
  Nada de clases CSS generadas.
- Los textos del flujo y del modal van en `src/config.ts`, no hardcodeados en el probe.
- No commitear `.env`, `out/` ni `.state/`.
- Las notificaciones de error deben ser accionables: incluir el paso que
  falló y un link al run de Actions (`GITHUB_SERVER_URL/GITHUB_REPOSITORY/actions/runs/GITHUB_RUN_ID`).

## Hallazgos del recon

Ver docs/RECON.md (se llena en la Fase 0). Si la página cambia, actualiza
ese archivo antes de tocar los selectores.
