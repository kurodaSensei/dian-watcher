# Recon — agendamiento.dian.gov.co

Fecha: 2026-10-24 (sábado, ~16:53 hora Colombia). Navegador: Chromium vía
Playwright MCP, IP residencial. No se envió ningún formulario.

## Resumen

- Es una SPA (WebForms + jQuery + Kendo UI, "C-Media WebPlayer" de Ciel
  Ingeniería). La URL **nunca cambia** (`/`), todo se pinta por JS.
- Los elementos clickeables **no tienen rol accesible** (`div` genéricos
  con `cursor: pointer`). No sirven `getByRole('button')`: hay que usar texto.
- El modal sale **apenas se hace clic en "Devoluciones."**, sin pulsar
  "Siguiente".
- La señal más confiable es el JSON de `ValidadorValidar`, no el DOM (ver §3).
- reCAPTCHA v2 se carga, pero **no se exige** en este tramo del flujo.

## 1. Pasos del flujo

Todos los clickeables tienen rol `generic` (snapshot de accesibilidad) y
no tienen nombre accesible propio.

| # | Paso (nombre para `ERROR.step`) | Texto visible exacto | Notas |
|---|---|---|---|
| 0 | `open` | — | `GET https://agendamiento.dian.gov.co/`. Título: `Agendamiento de Citas` (al inicio dice `C-Media WebPlayer - Ciel Ingeniería`; hay que esperar a que cambie). |
| 1 | `agendar-cita` | `Agendar cita` | Tarjeta con subtítulo `Programe cita para trámites o servicios.` Al lado está `Gestionar cita`. |
| 2 | `persona-natural` | `Persona Natural` | En el DOM son dos nodos en líneas distintas: `textContent` = `PersonaNatural` (sin espacio). El selector debe aceptar el espacio como opcional: `/^persona\s*natural$/i`. Encabezado: `Seleccione el tipo de persona`. |
| 3 | `video-atencion` | `Videoatención` | Una palabra, con tilde. Aparece tras el paso 2 bajo `¿Cómo prefiere la cita?` (la alternativa es `Presencial`). Regex sugerida: `/^video\s*atenci[oó]n\.?$/i`. |
| 4 | `devoluciones` | `Devoluciones.` | **Con punto final.** Aparece tras el paso 3 bajo `Seleccione el tipo de servicio`. Regex: `/^devoluciones\.?$/i`. |

Lista completa de servicios en Videoatención para persona natural (sirve
para detectar cambios): `RUT y orientación TAC.`, `Conferencias o
capacitaciones.`, `Devoluciones.`, `Autogestión servicios en línea con NAF.`,
`Inconsistencias Grandes Contribuyentes.`, `Cobranzas.`, `Defensoría.`

Botones `Anterior` / `Siguiente` siempre visibles; **no hacen falta** para
llegar al modal.

## 2. Modal "sin especialidades"

- Texto exacto:
  `No se encontraron especialidades relacionadas según los filtros seleccionados.`
- Se cierra con el elemento de texto `Aceptar` (también `generic`). Hay un
  ícono de cierre sin texto, pero no hay que usarlo.
- **Ojo:** al cerrar, el nodo **sigue en el DOM** (oculto). Por eso el
  texto aparece en el HTML aunque el modal ya no se vea. Consecuencias:
  - El probe debe medir visibilidad (`locator.isVisible()`) **antes** de
    cerrar, y pasarla en el `ProbeOutput` (p. ej. `modalVisible: boolean`).
  - `classify` no debe deducir `NO_SLOTS` solo porque el texto aparece en
    `final.html`. Prioridad: JSON de la API > visibilidad medida > texto.
- Plantilla del modal: `Recursos/CitasDIAN/Plantillas/_ModalSinCitas.html`.

## 3. Requests XHR

Al cargar la página (una vez):

| Método | URL | Notas |
|---|---|---|
| POST | `/Player.aspx/ObtenerTimeOutSesion` | Respuesta de 12 bytes |
| POST | `/Player.aspx/ObtenerConfiguracion` | ~525 KB, configuración del player |
| GET | `/Recursos/CitasDIAN/Plantillas/_*.html?t=YYYYMMDD` | Plantillas (`_PasoUno`…`_PasoCuatro`, `_ModalSinCitas`, `_ModalError`, …) |
| POST | `/Player.aspx/RegistrarNotificacion` | Log de errores del cliente (en esta corrida: `grecaptcha is not defined`). Ruido, no indica bloqueo. |

En **cada clic** del flujo se hace un `POST /Player.aspx/ValidadorValidar`:

- Headers relevantes de la request:
  - `requestverificationtoken: <token>` (base64 de un UUID, 48 caracteres)
  - `g-recaptcha-response:` (va **vacío** y aun así responde 200)
  - `x-requested-with: XMLHttpRequest`
  - `content-type: application/json; charset=UTF-8`
- Header de la respuesta: `x-token: <token nuevo>`. **El token rota en cada
  llamada:** el `x-token` de una respuesta es el `requestverificationtoken`
  de la siguiente. El cliente lo guarda en `<input type=hidden name=anticsrf>`
  (el valor inicial viene en el HTML de `/`).
- Body (no es JSON estricto, tiene comillas simples):
  ```
  {nombre:'ValidadorDatos.CitasWeb',
   configuracion:{"ConfiguracionServicioRestEncriptado":"<blob base64 fijo>", ..., "Archivo":{"Ruta":"Recursos/CitasDIAN/",...}, ...},
   respuestaBase:{"Fuente":"Validador","Encontrado":false,"DetalleAdicional":"<manejador>","ObjetosEncontrados":[...],"Recurso":"CitasDIAN"}}
  ```
- Respuesta: `{"d":"<JSON serializado como string>"}` (hay que hacer doble `JSON.parse`).

| Clic | `DetalleAdicional` (request) | `ObjetosEncontrados` (request) | Respuesta |
|---|---|---|---|
| Agendar cita | `manejadorEncontroTiposCliente` | `[]` | `Encontrado: true` (tipos de cliente) |
| Persona Natural | `manejadorEncontroTiposEspecialidad` | `[<cita JSON con UsuarioCliente.IdTipoCliente:"1">]` | `Encontrado: true`, `[[Presencial(1), Virtual(2)]]` |
| Videoatención | `manejadorEncontroCategoria` | `["2"]` | `Encontrado: true`, lista de 7 categorías (Devoluciones = `Codigo: "13"`, `IdCategoria: 63071985-f5bd-43fe-beed-38f64c97371b`) |
| **Devoluciones.** | `manejadorEncontroColas` | `[<cita JSON con TipoEspecialidad 2 "Virtual", Oficina "001">, "Nombre", "1", "13", "2"]` | **ver abajo** |

**Respuesta que alimenta el modal** (último `ValidadorValidar`):

```json
{"Fuente":null,"Encontrado":false,"MensajeAdicional":null,"ErrorString":null,
 "Observacion":"","ObjetosEncontrados":null,"TotalObjetosEncontrados":0,
 "RespuestaInterna":null,"DetalleAdicional":"manejadorNoEncontroColas","Recurso":""}
```

Señales para `classify`:
- `NO_SLOTS`: `DetalleAdicional === "manejadorNoEncontroColas"` (o `Encontrado: false` con `TotalObjetosEncontrados: 0`).
- `AVAILABLE` (hipótesis, no observado): `Encontrado: true` y `ObjetosEncontrados` con elementos;
  probablemente `DetalleAdicional: "manejadorEncontroColas"`. Confirmar cuando aparezcan citas
  y regenerar el fixture desde `out/api.json`.
- `ErrorString` distinto de null → `ERROR`.

## 4. Captcha, cookies y tokens

- **reCAPTCHA v2** (checkbox, `size=normal`, sitekey `6Lddf4UqAAAAAECc-yjsDQaGvH_9KbmSpjNCm_J6`).
  Se cargan 4 iframes, pero en este tramo el header `g-recaptcha-response`
  va vacío y el servidor responde 200. Lo más probable es que solo se exija
  al confirmar la cita (fuera de nuestro alcance). Si el captcha empieza a
  exigirse aquí, se verá como un `ErrorString` o como un modal de error
  (`_ModalError.html`) → clasificarlo como `BLOCKED`.
- **Cookies visibles por JS:** solo Google Analytics (`_ga*`). No revisé las
  HttpOnly (p. ej. `ASP.NET_SessionId`). Asumo que hay sesión de servidor
  ligada a la cadena de tokens.
- **Tokens:** `anticsrf` encadenado (ver §3), `__VIEWSTATE` / `__VIEWSTATEGENERATOR`
  de WebForms y `ConfiguracionServicioRestEncriptado`, un blob fijo dentro de la
  configuración.
- Infra: Azure Front Door (`x-azure-ref`), CSP estricta, sin señales de WAF
  ni de challenge en esta corrida.

## Decisión: ¿el endpoint se puede llamar sin navegador?

**Probablemente sí, pero no está verificado.** Haría falta:
1. `GET /` y extraer `anticsrf` (y quizás la cookie de sesión) del HTML.
2. Replicar las 4 llamadas a `ValidadorValidar` en orden, encadenando
   `x-token` → `requestverificationtoken`. Puede que el servidor valide el
   orden de los pasos; no lo probé.
3. Copiar el blob `ConfiguracionServicioRestEncriptado` (parece fijo; se
   puede leer de la página o de la request).

El riesgo es que la cadena de tokens o el captcha se vuelvan obligatorios.
**Recomendación:** quedarse con el probe de navegador (Fases 1–3), y que el
probe capture los JSON de `ValidadorValidar` en `api.json` para clasificar
con ellos. La Fase 4 sigue siendo opcional.

## Evidencia

- `test/fixtures/no-slots.html`: DOM con el modal abierto, sin `<script>` ni
  `<iframe>`, y con `__VIEWSTATE`, `__VIEWSTATEGENERATOR` y `anticsrf`
  cambiados por `REDACTED`. Se conservan los atributos `style` porque indican
  qué está visible.
- Screenshot local (no versionado): `.playwright-mcp/no-slots.png`.
