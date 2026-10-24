# Cómo poner a funcionar el vigilante de citas de la DIAN

Hola, Liska 👋 Esta guía es para que dejes funcionando, desde tu cuenta de
GitHub, un "vigilante" que revisa solo la página de citas de la DIAN y
**manda un aviso al celular cuando aparecen citas de Devoluciones**.

No necesitas saber programar. Son unos 20 minutos y solo se hace una vez.

---

## Qué hace, en pocas palabras

- Cada 4 horas, GitHub abre la página de la DIAN por su cuenta y hace los
  mismos clics que harías tú: *Agendar cita → Persona Natural →
  Videoatención → Devoluciones*.
- Si sale el mensaje "No se encontraron especialidades…", **no hace nada**.
  Que no lleguen avisos es buena señal.
- Si **hay citas**, manda una alerta fuerte al celular. La repite cada 4
  horas mientras sigan disponibles.
- Si algo se daña dos veces seguidas, manda un aviso suave para que alguien
  lo revise.
- Los lunes manda un "sigo vivo" para que sepas que sigue funcionando.

Horarios en Colombia: **3:07 a. m., 7:07 a. m., 11:07 a. m., 3:07 p. m.,
7:07 p. m. y 11:07 p. m.** GitHub a veces se atrasa unos minutos; es normal.

**¿Cuesta algo?** No. Usa los minutos gratis de GitHub: unos 300–450
minutos al mes, de los 2.000 gratis que da a los repositorios privados.

---

## Lo que necesitas

- [ ] Una cuenta de GitHub (https://github.com)
- [ ] El archivo **`dian-watcher.zip`** que te pasaron
- [ ] Un computador (Mac o Windows) para subirlo una sola vez
- [ ] El celular donde quieras recibir los avisos (y si quieres, también el
      de quien te pasó esto)

---

## Paso 1. Instala ntfy en el celular

ntfy es la app gratuita que recibe los avisos.

1. Instala **ntfy** desde la App Store (iPhone) o Google Play (Android).
2. Inventa un **nombre de canal** largo y difícil de adivinar, como si fuera
   una contraseña. Cualquiera que lo sepa puede leer los avisos.
   - Ejemplo del formato: `dian-devoluciones-7hq2m9xk4p`
   - Usa solo letras minúsculas, números y guiones, sin espacios ni tildes.
3. En la app toca **+** (Suscribirse / Subscribe), escribe ese nombre y
   confirma. Deja el servidor como viene (`ntfy.sh`).
4. **Anota el nombre en un lugar seguro.** Lo vas a usar en el Paso 4.

> Si alguien más quiere recibir los avisos, solo tiene que suscribirse en
> su ntfy al **mismo** nombre.

**En iPhone:** cuando la app pida permiso para enviar notificaciones, dile
que **sí**.

### Prueba rápida de que el celular recibe avisos

Antes de seguir, confirma que el celular sí recibe:

1. En el computador abre `https://ntfy.sh/` seguido de tu nombre de canal.
   Ejemplo: `https://ntfy.sh/dian-devoluciones-7hq2m9xk4p`
2. Abajo hay un cuadro para escribir. Escribe "hola" y envíalo (flecha o
   Enter).
3. En unos segundos te debe llegar "hola" al celular.

**Si no llega:**

- **El nombre no es idéntico.** Abre el canal en la app y compara letra
  por letra con el del navegador. Un guion o una letra distinta es otro
  canal. Si tienes dudas, borra la suscripción y créala de nuevo copiando
  y pegando el nombre.
- **El servidor no es el correcto.** Al suscribirte debe decir `ntfy.sh`. No
  marques "usar otro servidor" (*Use another server*).
- **Las notificaciones están apagadas.**
  - iPhone: *Ajustes → Notificaciones → ntfy → Permitir notificaciones*
    activado. Revisa también que no tengas un modo Concentración (Focus)
    o No molestar que las silencie.
  - Android: *Ajustes → Aplicaciones → ntfy → Notificaciones* activadas.
    En *Batería*, ponla como **Sin restricciones**, para que el sistema no
    la cierre.
- **Abre la app y entra al canal.** Si ves el mensaje adentro pero no te
  llegó la alerta, el problema es solo de permisos de notificación (punto
  anterior).
- **Los mensajes viejos no se avisan.** Si te suscribiste *después* de que
  se envió un aviso, puede que aparezca dentro de la app pero sin alerta.
  Envía uno nuevo desde el navegador para probar.

---

## Paso 2. Descomprime el archivo

1. Haz doble clic en **`dian-watcher.zip`**. Aparece una carpeta llamada
   **`dian-watcher`**.
2. Déjala en un lugar fácil de encontrar, como Documentos.
   No le cambies nada por dentro.

---

## Paso 3. Súbelo a tu GitHub con GitHub Desktop

GitHub Desktop es la app oficial de GitHub y permite subir la carpeta sin
usar comandos.

1. Descarga e instala **GitHub Desktop**: https://desktop.github.com
2. Ábrelo e inicia sesión con tu cuenta de GitHub
   (*Sign in to GitHub.com*).
3. En el menú de arriba elige **File → Add Local Repository…**
   (Archivo → Agregar repositorio local).
4. Toca **Choose…**, busca la carpeta **`dian-watcher`** del Paso 2 y
   confirma con **Add Repository**.
5. Arriba aparece un botón azul **Publish repository**. Tócalo.
6. En la ventana que se abre:
   - **Name:** `dian-watcher` (o el nombre que quieras)
   - ✅ **Deja marcada la casilla "Keep this code private"** (mantener
     privado). Es importante.
   - Toca **Publish repository**.
7. Listo. Ya está en tu GitHub. Puedes cerrar GitHub Desktop.

---

## Paso 4. Guarda el nombre del canal como "secreto" en GitHub

Así el vigilante sabe a dónde mandar los avisos, sin que el nombre quede a
la vista.

1. Entra a https://github.com y abre tu repositorio **dian-watcher**.
2. Arriba toca **Settings** (Configuración, el ícono de engranaje).
   En el celular puede estar escondido en el menú **···**.
3. En el menú de la izquierda busca **Secrets and variables** y elige
   **Actions**.
4. Toca el botón verde **New repository secret**.
5. Llénalo así:
   - **Name:** `NTFY_TOPIC` (exactamente así, en mayúsculas y con guion bajo)
   - **Secret:** el nombre de canal que inventaste en el Paso 1
6. Toca **Add secret**.

---

## Paso 5. Haz la primera prueba

1. En tu repositorio toca la pestaña **Actions**.
   - Si aparece un botón verde que dice algo como *"I understand my
     workflows, go ahead and enable them"*, tócalo.
2. A la izquierda toca **watch**.
3. A la derecha aparece **Run workflow**. Tócalo.
4. ✅ **Marca la casilla "Enviar una notificación de prueba al celular"**.
5. Toca el botón verde **Run workflow**.
6. Espera 2 o 3 minutos y recarga la página.

**Cómo saber si funcionó:**

| Lo que ves | Qué significa |
|---|---|
| ✅ Círculo verde en la corrida **y** llega al celular "Prueba del DIAN watcher" | **¡Todo listo!** Ya no tienes que hacer nada más |
| ✅ Verde, pero **no** llega nada al celular | El nombre del secreto o del canal no coincide. Revisa el Paso 4 (debe decir `NTFY_TOPIC`) y que el canal en ntfy sea idéntico, letra por letra |
| ❌ Círculo rojo | Mira la sección "Si algo sale mal" más abajo |

El aviso de prueba también dice el resultado. Hoy debería decir
**`NO_SLOTS`**, que quiere decir "no hay citas todavía".

A partir de aquí funciona solo, cada 4 horas, **aunque tengas el
computador apagado**.

---

## Los avisos que pueden llegar

| Aviso | Qué hacer |
|---|---|
| 🚨 **"¡Hay citas de Devoluciones en la DIAN!"** | Entrar ya a https://agendamiento.dian.gov.co/ y agendar. Llega con sonido fuerte |
| ⏳ "Se acabaron las citas" | Nada. Ya no hay; el vigilante sigue revisando |
| ⚠️ "DIAN watcher: fallando" | Algo cambió o la página falló dos veces seguidas. Ver abajo |
| ✅ "DIAN watcher operativo de nuevo" | Se arregló solo. Nada que hacer |
| 💓 "DIAN watcher sigue vivo" | Llega los lunes. Todo bien |

---

## Si algo sale mal

**Llega "DIAN watcher: fallando" una vez y después "operativo de nuevo":**
fue algo pasajero (la página de la DIAN estaba lenta). Ignóralo.

**Llega "fallando" y no se arregla en uno o dos días:** probablemente la
DIAN cambió su página, o está bloqueando a GitHub. Pásale el aviso a quien
te dio esto. Si tocas el aviso, se abre la corrida que falló. Para dar más
información:
1. Abre la corrida roja en la pestaña **Actions**.
2. Abajo, en **Artifacts**, descarga **evidencia-…**. Trae una foto de cómo
   se veía la página y otros archivos que sirven para arreglarlo.
3. Envía ese archivo.

**El aviso dice "Bloqueado":** la DIAN está rechazando las visitas que
vienen de GitHub. No es culpa tuya. Igual que arriba: avisa y envía la
evidencia.

**Quiero pausarlo:** Actions → **watch** → botón **···** de la derecha →
**Disable workflow**. Para reactivarlo, el mismo lugar → **Enable workflow**.

**Quiero borrarlo del todo:** Settings → baja hasta el final →
**Delete this repository**.

---

## Preguntas rápidas

- **¿Tengo que dejar algo prendido?** No. Corre en los computadores de GitHub.
- **¿Puede agendar la cita por mí?** No. Solo avisa; la cita la agenda una
  persona.
- **¿Hay riesgo para mi cuenta?** No. El repositorio es privado, el
  vigilante solo *mira* la página (no llena formularios) y revisa cada
  4 horas, que es muy poco.
- **¿Llegan correos de GitHub cuando falla?** Puede que GitHub te mande un
  correo cuando una corrida sale en rojo. Es normal.
