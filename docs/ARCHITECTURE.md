# Arquitectura — DIAN watcher

## Objetivo

Cada hora, comprobar si el flujo de https://agendamiento.dian.gov.co/
(Agendar cita → Persona natural → Video atención → Devoluciones) muestra
especialidades disponibles, y avisar por push cuando sí las hay.

## Vista general

```
           ┌───────────────── GitHub Actions (cron 7 * * * *) ───────────────────┐
           │                                                                      │
           │   restore state.json (actions/cache)                                 │
           │            │                                                         │
           │            ▼                                                         │
           │   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
           │   │    Probe     │──▶│   Classify   │──▶│    Policy    │            │
           │   │ (browser|api)│   │  → Status    │   │ (¿notificar?)│            │
           │   └──────────────┘   └──────────────┘   └──────┬───────┘            │
           │          │ evidencia (png/json/html)            │                    │
           │          ▼                                      ▼                    │
           │   upload-artifact                       ┌──────────────┐            │
           │                                         │   Notifier   │──▶ ntfy.sh  │
           │                                         └──────────────┘            │
           │   save state.json (actions/cache)                                    │
           └──────────────────────────────────────────────────────────────────────┘
```

Una sola ejecución por corrida, sin servidor ni base de datos. Todo el
estado cabe en un `state.json`.

## Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `src/config.ts` | Lee y valida variables de entorno (zod). Expone timeouts, textos del flujo y modo de probe. | — |
| `src/probe/types.ts` | Interface `Probe { run(): Promise<ProbeOutput> }` y tipos de evidencia. | — |
| `src/probe/browser.ts` | Implementación con Playwright: recorre el flujo por texto visible y devuelve el DOM final, el screenshot y las respuestas JSON capturadas. | config |
| `src/probe/api.ts` | *(Fase 4, opcional)* Llama directo al endpoint descubierto en el recon. | config |
| `src/classify.ts` | Función **pura**: `ProbeOutput → Status`. Sin I/O. | types |
| `src/state.ts` | Lee y escribe `state.json`: último estado, fallos consecutivos y fecha del último aviso. | — |
| `src/policy.ts` | Función **pura**: `(Status, State) → Decision` (notificar o no, prioridad y mensaje). | types |
| `src/notify/ntfy.ts` | `Notifier` para ntfy (POST JSON). | config |
| `src/notify/console.ts` | `Notifier` de desarrollo/dry-run. | — |
| `src/index.ts` | Orquestador: probe → classify → policy → notify → persistir estado y evidencia. Define el exit code. | todos |

**Regla:** la lógica de decisión (`classify`, `policy`) es pura y se
testea con fixtures. Lo que toca red o navegador (`probe`, `notify`)
queda en los bordes.

## Modelo de estados

```ts
type Status =
  | { kind: 'NO_SLOTS' }                       // apareció el modal "No se encontraron especialidades"
  | { kind: 'AVAILABLE'; detail?: string }     // el flujo avanzó / hay especialidades
  | { kind: 'BLOCKED'; reason: string }        // captcha, 403, página de bloqueo
  | { kind: 'ERROR'; step: string; message: string } // timeout, selector no encontrado, etc.
```

Señales de clasificación, en orden de prioridad:
1. Captcha o texto de bloqueo, o status HTTP 403/429 → `BLOCKED`
2. Excepción en un paso del flujo → `ERROR` (con el nombre del paso)
3. Texto `/No se encontraron especialidades/i` visible → `NO_SLOTS`
4. Ninguno de los anteriores **y** hay evidencia positiva (opciones o
   especialidades listadas, o un JSON con elementos) → `AVAILABLE`
5. Sin evidencia positiva ni negativa → `ERROR` ("estado ambiguo")

> El punto 5 evita el falso positivo de "no salió el modal porque la
> página no cargó".

## Política de notificación

| Situación | Acción | Prioridad ntfy |
|---|---|---|
| `AVAILABLE` | Notificar **siempre** (cada corrida mientras siga disponible) | 5 (urgente) |
| `NO_SLOTS` tras un `AVAILABLE` | Notificar "se acabaron las citas" | 3 |
| `NO_SLOTS` normal | Nada | — |
| `ERROR`/`BLOCKED` | Notificar solo al llegar a **2 fallos consecutivos** y luego máximo 1 vez cada 24 h | 2 |
| Recuperación tras errores | Notificar "watcher operativo de nuevo" | 1 |
| Heartbeat | Opcional: 1 aviso semanal "sigo vivo" | 1 |

## Estado persistido (`state.json`)

```json
{
  "lastStatus": "NO_SLOTS",
  "lastChangeAt": "2026-10-24T21:07:00Z",
  "consecutiveFailures": 0,
  "lastFailureNotifiedAt": null,
  "lastHeartbeatAt": null
}
```

En GitHub Actions se persiste con `actions/cache` (restore al inicio,
save al final, key con `run_id` y `restore-keys` por prefijo). Si se
pierde, se arranca en limpio y no pasa nada grave.

## Configuración (env)

| Variable | Default | Uso |
|---|---|---|
| `NTFY_TOPIC` | — (requerida en CI) | Tópico ntfy; secret de GitHub |
| `NTFY_SERVER` | `https://ntfy.sh` | Por si se usa uno self-hosted |
| `PROBE` | `browser` | `browser` \| `api` |
| `HEADED` | `0` | `1` para ver el navegador en local |
| `DRY_RUN` | `0` | `1` = usa el ConsoleNotifier |
| `STEP_TIMEOUT_MS` | `30000` | Timeout por paso |
| `STATE_PATH` | `.state/state.json` | Ruta del estado |

## Evidencia

Cada corrida escribe en `out/`:
- `final.png`: screenshot de página completa
- `final.html`: DOM final (sirve para crear fixtures nuevas)
- `api.json`: respuestas JSON capturadas (método, url, status, body truncado)
- `result.json`: el `Status` y la `Decision`

`upload-artifact` sube `out/` con retención de 7 días.

## Exit codes

- `0`: corrida completa, sin importar si hubo citas o no
- `1`: `ERROR`/`BLOCKED` (para que el run aparezca rojo en Actions)

## Stack

- Node 24 LTS + TypeScript (ESM), ejecutado con `tsx`
- Playwright (solo Chromium)
- zod para la configuración
- vitest para los tests de `classify` y `policy` con fixtures HTML/JSON
- GitHub Actions como scheduler

## Decisiones y alternativas descartadas

- **Playwright antes que el API directo:** hasta no hacer el recon no se
  sabe si el endpoint exige sesión o token. La interface `Probe` permite
  cambiar a `api.ts` sin tocar nada más.
- **ntfy antes que Telegram o email:** cero setup y push inmediato. El
  `Notifier` es intercambiable.
- **GitHub Actions antes que la máquina local:** no depende de que el
  equipo esté prendido. Plan B si bloquean las IPs de datacenter: el
  mismo `npm run check` con cron o launchd en local.
- **Claude como runtime del chequeo (claude-code-action / `claude -p`)
  descartado:** es no determinista y cuesta tokens en cada corrida para
  algo que un script hace igual de bien. Claude Code se usa para
  **construirlo** y para el **recon**, no para ejecutarlo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Cambian los textos o el DOM | Selectores por texto tolerantes; estado `ERROR` con el paso; `final.html` para regenerar fixtures |
| Captcha / anti-bot | Estado `BLOCKED` con aviso; frecuencia baja; plan B con IP residencial |
| Falso positivo por página a medio cargar | Exigir evidencia positiva (regla 5) |
| GitHub pausa el cron tras 60 días sin commits | Heartbeat semanal y re-activar desde Actions; opcional un workflow keepalive |
| Spam de errores | Umbral de 2 fallos consecutivos y throttle de 24 h |
