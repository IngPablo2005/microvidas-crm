# Cómo publicar el CRM en un link web (gratis)

Esta guía deja el CRM andando en una URL propia, accesible desde la PC y desde el iPhone (agregándolo a la pantalla de inicio como si fuera una app), sin depender de que tu computadora esté prendida.

Arquitectura elegida: la app (backend + frontend) vive en **Render** (hosting gratuito) y la base de datos vive separada en **Turso** (base de datos gratuita que nunca se borra, aunque actualicemos la app). El código vive en **GitHub**, y cada vez que se sube un cambio, Render lo despliega solo.

Ninguna de las tres cuentas pide tarjeta de crédito.

## Paso 1 — Crear las 3 cuentas gratuitas

1. **GitHub** (donde vive el código): [github.com/signup](https://github.com/signup) — con tu email y una contraseña.
2. **Turso** (la base de datos): [turso.tech](https://turso.tech) → "Get Started" → podés entrar directo con tu cuenta de GitHub.
3. **Render** (donde corre la app): [render.com](https://render.com) → "Get Started" → también podés entrar con tu cuenta de GitHub.

Cuando tengas las tres, avisame los nombres de usuario (o simplemente decime "ya las creé") y sigo con el resto.

## Paso 2 — Crear la base de datos en Turso

1. Adentro de Turso, creá una base de datos nueva (botón "Create Database"). Ponele de nombre `microvidas-crm`.
2. Elegí la región más cercana (por ejemplo, alguna de Sudamérica o EE.UU. según lo que ofrezca).
3. Una vez creada, buscá:
   - La **URL de la base** (empieza con `libsql://...`)
   - Un **Auth Token** (Turso lo genera con un botón "Create Token" o similar)
4. Pasame esos dos valores acá en el chat (o subilos como archivo) — los voy a usar solo para configurar el despliegue, no quedan expuestos en ningún lado público.

## Paso 3 — Subir el código a GitHub (con GitHub Desktop)

Por una restricción de seguridad de mi entorno de trabajo, no puedo subir el código directamente a tu cuenta de GitHub — lo tenés que hacer vos, una sola vez para el primer envío, con un programa gratuito y sin usar la terminal:

1. Descargá e instalá **GitHub Desktop**: [desktop.github.com](https://desktop.github.com).
2. Abrilo e iniciá sesión con tu cuenta de GitHub (`ingpablo2005`).
3. "File" → "Clone repository" → pestaña "GitHub.com" → elegís `ingpablo2005/microvidas-crm` (el repositorio vacío que ya creaste) → "Clone". Elegí cualquier carpeta de tu PC, por ejemplo tu carpeta de Documentos.
4. Te voy a pasar un archivo `.zip` con todo el código. Extraelo (clic derecho → "Extraer todo" en Windows, o doble clic en Mac) y copiá **todo el contenido de adentro** (las carpetas `client`, `server`, y los archivos sueltos como `README.md`, `render.yaml`, etc.) directamente dentro de la carpeta que clonaste en el paso 3 — no la carpeta del zip en sí, sino lo que está adentro de ella.
5. Volvés a GitHub Desktop: vas a ver automáticamente la lista de todos los archivos nuevos. Abajo a la izquierda escribís un resumen como "Primera versión" y tocás **"Commit to main"**.
6. Arriba, botón **"Push origin"**. Listo — el código ya está en tu repositorio de GitHub.

Para cada actualización futura que te pase (una mejora, una corrección), el proceso se repite igual: te doy el zip actualizado, reemplazás los archivos en esa misma carpeta, y en GitHub Desktop volvés a hacer "Commit to main" → "Push origin". Dos clics.

## Paso 4 — Conectar Render

1. En Render, botón "New +" → "Blueprint".
2. Elegís el repositorio de GitHub del CRM (Render te va a pedir autorizar el acceso a tu cuenta de GitHub la primera vez).
3. Render detecta automáticamente el archivo `render.yaml` que ya está en el proyecto, y te va a pedir completar dos casilleros:
   - `TURSO_DATABASE_URL` → pegás la URL de Turso del Paso 2.
   - `TURSO_AUTH_TOKEN` → pegás el token de Turso del Paso 2.
4. Confirmás y Render hace el primer despliegue (tarda unos minutos). Al terminar te da una URL del tipo `https://microvidas-crm.onrender.com`.

## Paso 5 — Cargar los datos iniciales

La base de Turso empieza vacía (sin usuarios ni datos de ejemplo), aunque la app ya esté "Live" en Render. Para cargarlos, una sola vez:

1. En Render, entrá al servicio → **"Environment"** y copiá el valor de la variable **`ADMIN_SEED_KEY`** (Render la generó sola).
2. Abrí en el navegador (con tu link real y esa clave pegada al final):
   `https://microvidas-crm.onrender.com/api/admin/seed?key=LA_CLAVE_QUE_COPIASTE`
3. Debería responder algo como `{"ok":true, "message":"Listo..."}`. Ya podés entrar a la app y hacer login.

Esta dirección es segura para dejarla así: sin la clave correcta responde "forbidden", y si ya hay datos cargados no los duplica ni los borra aunque la visites de nuevo por error.

## Borrar los datos de ejemplo para cargar datos reales

Cuando quieras dejar de usar los datos de prueba (los 10 clientes, ventas, cotizaciones, etc. de ejemplo) y empezar a cargar los tuyos, abrí en el navegador (con la misma `ADMIN_SEED_KEY` del paso anterior):

`https://microvidas-crm.onrender.com/api/admin/reset-data?key=LA_CLAVE&confirm=BORRAR`

Esto borra clientes, prospectos, ventas, cotizaciones, pipeline, tareas, calendario, cobranzas y productos de ejemplo. **No borra los usuarios ni la configuración**, así que tu login sigue funcionando igual que antes. Si te olvidás del `&confirm=BORRAR` al final, la página te lo va a recordar en vez de borrar algo por error.

Los usuarios de ejemplo (Lucía Fernández, Martín Gómez, Sofía Ramírez, Consulta Directorio) quedan cargados con la contraseña `microvidas2026`; podés desactivarlos o cambiarles el rol desde Configuración → Usuarios dentro de la app, o dejarlos y renombrarlos para tu equipo real.

## Cómo se actualiza de ahí en adelante

- **Cuando te haga una mejora en una sesión como esta**, te paso el zip actualizado y hacés los dos clics en GitHub Desktop ("Commit to main" → "Push origin") descriptos en el Paso 3. En cuanto el push llega a GitHub, Render detecta el cambio y redespliega solo — no hay que tocar nada en Render.
- **Si en algún momento querés forzar una actualización manual** (por ejemplo, redesplegar sin que haya cambios nuevos), entrás al dashboard de Render desde el navegador de tu PC o del teléfono, y tocás "Manual Deploy" → "Deploy latest commit". Funciona igual de bien desde el celular que desde la PC, porque es solo una página web.
- Los datos (clientes, ventas, cobranzas, etc.) viven en Turso, separados de la app — así que un redespliegue nunca los borra.

## Sobre el nivel gratuito

- Render free: el servicio se "duerme" después de 15 minutos sin uso, y la primera visita después de eso tarda unos 30-50 segundos en responder mientras se despierta. Las visitas siguientes son rápidas.
- Turso free: guarda hasta varios GB de datos, muy por encima de lo que un CRM como este va a usar.
- Si en el futuro esto se usa todos los días por el equipo y la demora al "despertar" molesta, se puede pasar el servicio de Render a un plan pago económico (~USD 7/mes) sin tocar nada del código ni de los datos.

## Usar el CRM desde el iPhone como una app

Una vez que el link esté funcionando:
1. Abrí el link en Safari (no en Chrome — la función de iOS solo funciona desde Safari).
2. Tocá el botón de compartir (el cuadrado con la flecha hacia arriba).
3. Elegí "Agregar a pantalla de inicio".
4. Va a aparecer un ícono propio del CRM en tu pantalla de inicio, y al abrirlo se ve sin las barras del navegador, como una app instalada.
