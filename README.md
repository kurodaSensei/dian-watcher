# DIAN watcher

Revisa cada 4 horas si hay citas de **Devoluciones** (videoatención, persona
natural) en https://agendamiento.dian.gov.co/ y avisa al celular con
[ntfy](https://ntfy.sh).

- **Para desplegarlo en GitHub (sin conocimientos técnicos):** [DESPLIEGUE.md](DESPLIEGUE.md)
- Arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Recon del sitio: [docs/RECON.md](docs/RECON.md)

## Uso local

```bash
npm install
npx playwright install chromium
cp .env.example .env   # y pon tu NTFY_TOPIC
npm run check:dry      # corrida real, sin notificar
```

| Comando | Qué hace |
|---|---|
| `npm run check` | Corrida real que notifica |
| `npm run check:headed` | Igual, con el navegador visible |
| `npm run check:dry` | Corrida real que imprime la notificación en vez de enviarla |
| `npm test` | Tests de classify, policy y state (nunca tocan el sitio) |
| `npm run typecheck` | `tsc --noEmit` |

`NOTIFY_TEST=1` agrega una notificación de prueba a la corrida.

## Si la DIAN cambia la página

1. Descarga el artifact `evidencia-…` del run fallido en Actions y abre
   `final.png` / `final.html` / `api.json`.
2. Actualiza `docs/RECON.md` y luego los textos en `src/config.ts`.
3. Si cambió el estado final, copia `final.html` a `test/fixtures/` (redacta
   `__VIEWSTATE` y `anticsrf`) y actualiza el test de `classify`.
4. `npm test && npm run check:dry`.
