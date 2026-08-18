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

## Paso 3 — Subir el código a GitHub

Esto lo hago yo por vos una vez que me confirmes que ya tenés la cuenta de GitHub creada: te voy a pasar el link de un repositorio para que lo autorices, o te doy los comandos exactos si preferís hacerlo vos mismo desde la terminal.

## Paso 4 — Conectar Render

1. En Render, botón "New +" → "Blueprint".
2. Elegís el repositorio de GitHub del CRM (Render te va a pedir autorizar el acceso a tu cuenta de GitHub la primera vez).
3. Render detecta automáticamente el archivo `render.yaml` que ya está en el proyecto, y te va a pedir completar dos casilleros:
   - `TURSO_DATABASE_URL` → pegás la URL de Turso del Paso 2.
   - `TURSO_AUTH_TOKEN` → pegás el token de Turso del Paso 2.
4. Confirmás y Render hace el primer despliegue (tarda unos minutos). Al terminar te da una URL del tipo `https://microvidas-crm.onrender.com`.

## Paso 5 — Cargar los datos iniciales

Una sola vez, hay que "sembrar" la base con los datos de ejemplo (o podés arrancar vacío y cargar todo a mano desde la app). Si querés los datos de ejemplo, avisame cuando el Paso 4 esté listo y lo hago yo, corriendo el script de siembra contra tu base de Turso.

## Cómo se actualiza de ahí en adelante

- **Cuando yo (Claude) te haga una mejora en una sesión como esta**, subo el cambio a GitHub y Render redespliega solo — no tenés que hacer nada.
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
