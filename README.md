# Microvidas CRM — Prototipo funcional

CRM comercial (clientes, prospectos, pipeline, cotizaciones, ventas, cobranzas, tareas, calendario, reportes e importación/exportación de Excel) construido como prototipo navegable, según la especificación "CRM Comercial — Gestión de Clientes, Ventas y Actividades".

## Stack

- **Backend:** Node.js + Express, base de datos SQLite/libSQL (vía `@libsql/client`) — funciona con un archivo local para desarrollo, o contra una base gestionada en [Turso](https://turso.tech) en producción, sin cambiar código. Autenticación con JWT.
- **Frontend:** React + Vite + Tailwind CSS + Recharts + React Router. Instalable en iPhone como PWA (agregar a pantalla de inicio desde Safari).
- **Datos de ejemplo:** 10 clientes, 5 prospectos, 20+ ventas, cotizaciones, cobranzas, tareas y eventos de calendario con contexto de agroinsumos (Microvidas), listos para explorar sin configurar nada.

## Publicar en un link web (PC + iPhone)

Ver [`DEPLOY.md`](./DEPLOY.md) para la guía paso a paso de cómo publicar el CRM gratis en Render + Turso, con un link permanente accesible desde cualquier dispositivo y actualizable con un clic.

## Cómo correrlo

### 1. Backend

```bash
cd server
npm install
npm run seed        # crea y siembra la base de datos SQLite (solo la primera vez)
npm run dev          # levanta la API en http://localhost:4000
```

### 2. Frontend

En otra terminal:

```bash
cd client
npm install
npm run dev          # levanta la app en http://localhost:5173 (proxy hacia :4000)
```

O, para producción, generar el build y dejar que el propio backend lo sirva:

```bash
cd client && npm install && npm run build
cd ../server && npm run dev   # ahora http://localhost:4000 sirve la app completa
```

### Variables de entorno (opcionales para desarrollo local)

Sin configurar nada, el backend usa un archivo SQLite local (`server/data/crm.db`) — así es como corre hoy en este entorno de trabajo. Para producción (ver `DEPLOY.md`), se configuran estas variables en el hosting:

- `TURSO_DATABASE_URL` — URL de la base de datos gestionada en Turso (si no se define, usa el archivo local).
- `TURSO_AUTH_TOKEN` — token de autenticación de esa base.
- `JWT_SECRET` — clave para firmar los tokens de login (si no se define, usa una clave de desarrollo; en producción conviene definir una propia).

## Usuario de acceso

- Email: `psolier@microvidas.com.ar`
- Contraseña: `microvidas2026`
- Rol: Administrador (también hay usuarios Gerente y Vendedor precargados, todos con la misma contraseña)

## Reiniciar los datos de ejemplo

```bash
cd server
npm run seed:force   # borra todo y vuelve a sembrar
```

## Estructura

```
server/   API REST (rutas por módulo), base SQLite, importación/exportación Excel
client/   Aplicación React (dashboard, clientes, prospectos, pipeline, cotizaciones,
          ventas, cobranzas, tareas, calendario, reportes, importación, configuración)
```

## Qué está implementado

Todos los módulos de la especificación original: dashboard con KPIs y alertas inteligentes, ficha de cliente con timeline/hitos/contactos/documentos/cuenta corriente, prospectos con conversión a cliente, pipeline visual, cotizaciones con cálculo automático e items, ventas con filtros, cobranzas con cuenta corriente y compromisos de pago, tareas y calendario (día/semana/mes) integrados, reportes con gráficos, importación masiva desde Excel con mapeo de columnas y detección de duplicados, exportación a Excel/CSV/PDF, buscador global, y usuarios con roles (Administrador, Gerente, Vendedor, Consulta).

### Eliminar clientes y registrar visitas/llamadas desde el Dashboard

- **Eliminar cliente:** desde el listado de Clientes (ícono de tacho en cada fila) o desde la ficha del cliente ("Eliminar cliente", arriba a la derecha). Pide confirmación porque es irreversible: borra también todas sus ventas, cotizaciones, cobranzas, facturas, tareas, notas, hitos, adjuntos y oportunidades de pipeline asociadas, para no dejar datos sueltos en otros módulos.
- **Registrar visita o llamada:** en el Dashboard hay una tarjeta "Registrar visita o llamada" para anotar rápido un contacto con un cliente (sin entrar a su ficha), con fecha y comentario opcional. También se puede registrar directamente desde la ficha del cliente, con el botón "Registrar visita/llamada" (arriba, junto a "Agregar nota" y "Crear tarea"). En ambos casos queda guardado en el historial del cliente y alimenta el reporte semanal (visitas y llamadas realizadas). Si la fecha registrada es más reciente que la que ya tenía el cliente, también actualiza su "último contacto".
- **Editar cliente:** desde la ficha del cliente ("Editar cliente", arriba a la derecha) se puede modificar cualquier dato del perfil en cualquier momento.
- **Cultivos y superficie sembrada:** en la ficha de cada cliente, pestaña "Cultivos", se carga la superficie (en hectáreas) de Soja, Soja 2da, Trigo, Maíz, Girasol, Sorgo, Pasturas, Vicia, Arveja, Arroz y Otros. El total se muestra también en el encabezado de la ficha.
- **Editar ventas y cotizaciones:** al hacer clic en una venta o cotización de sus respectivos listados se abre el detalle, con un botón "Editar" que permite modificar fecha, responsable, observaciones y los productos. Cada venta o cotización admite hasta 5 productos (con nombre, cantidad y precio en U$). Si una venta editada ya tenía una factura y cobranzas registradas, el saldo pendiente se recalcula automáticamente sin perder lo ya cobrado.
- **Reportes de ventas y cotizaciones con detalle por producto:** el botón "Exportar" de Ventas y de Cotizaciones ahora descarga un renglón por cada producto vendido/cotizado, con cantidad, precio unitario y monto en U$ (antes solo mostraba el total de la operación).
- **Alerta "Sin llamadas ni visitas" corregida:** la alerta inteligente de contacto ahora mira específicamente el historial de llamadas y visitas registradas de cada cliente (tabla de actividades), no solo el campo genérico "último contacto". Si un cliente activo no tiene ninguna llamada o visita registrada en los últimos N días (o nunca tuvo una), aparece en "Alertas inteligentes" del Dashboard. El N se sigue configurando desde Configuración → Parámetros comerciales → "Días sin llamadas o visitas para alertar" (mismo campo que antes, ahora con este nombre más preciso).
- **Paginación en el listado de Clientes:** antes solo se mostraban los primeros 100 clientes cargados, sin forma de ver el resto. Ahora el listado se pagina de a 50 (con botones "Anterior"/"Siguiente" y el total de clientes encontrados), y el filtro de provincia siempre lista todas las provincias cargadas, no solo las de la página visible.
- **Editar, posponer y eliminar tareas:** en Tareas, cada fila tiene tres acciones — el lápiz abre el formulario para editar cualquier dato (incluido el estado); el reloj abre "Posponer tarea" con atajos de +1/+3/+7 días o una fecha puntual, y si la tarea estaba vencida la deja como Pendiente al posponerla; el tacho la elimina (pide confirmación). Además, las tareas vencidas (fecha ya pasada y no completadas) ahora se resaltan en rojo con un ícono de alerta en el listado, aunque su campo "estado" todavía diga "Pendiente" — antes pasaban desapercibidas.

### Notificaciones y alertas de tareas/eventos programados

La campana en el header (arriba a la derecha) revisa cada 45 segundos si hay recordatorios vencidos:

- **Eventos de calendario:** se avisan según el campo "Recordatorio" configurado en el evento (5 min antes, 15 min antes, 30 min antes, 1 hora antes, 1 día antes).
- **Tareas programadas:** se avisan en cuanto llega la fecha/hora asignada y mientras no estén marcadas como "Completada" (las vencidas se marcan como "VENCIDA").
- Cada aviso muestra un contador de no leídos, se puede marcar como leído individualmente o todos juntos, y al hacer clic navega directo al cliente o módulo relacionado.
- Si el navegador tiene permiso otorgado, además dispara una notificación nativa del sistema operativo (push del navegador), incluso si la pestaña no está en foco.
- Los avisos no se duplican: cada recordatorio se registra una sola vez en la base (tabla `notifications`, con `ref_table`/`ref_id` apuntando al evento o tarea de origen).

### Reporte semanal (Reportes → "Generar reporte semanal")

En la pantalla de Reportes hay dos botones para descargar un resumen de la actividad comercial de los últimos 7 días:

- **Generar reporte semanal:** descarga un PDF con el período, los totales (visitas realizadas, llamadas realizadas, ventas con cantidad e importe, cobranzas con cantidad e importe) y el detalle desagregado por responsable/vendedor.
- **Reporte semanal (Excel):** el mismo contenido en una planilla, para quien prefiera manipular los datos.
- Las "visitas" y "llamadas realizadas" se toman de la tabla de actividades (`activities`, tipos `Visita` y `Llamada`) que ya registra cada interacción en la ficha de cliente; ventas y cobranzas se toman de sus respectivos módulos.

### Tareas diarias de la semana (Reportes → "Tareas diarias de la semana")

Además del resumen anterior, en Reportes hay una sección que muestra, día por día (Lunes a Viernes de la semana en curso), las tareas comerciales realizadas: llamadas, visitas, ensayos, cotizaciones, ventas y cobranzas — con el detalle escrito tal cual se cargó en cada una (no solo un total).

- **Registrar ensayo:** la tarjeta del Dashboard "Registrar visita, llamada o ensayo" también permite cargar ensayos de campo, con el mismo formato que visitas y llamadas (cliente, fecha y comentario).
- La sección de Reportes agrupa por día y categoría: para llamadas, visitas y ensayos muestra el comentario escrito al cargarlos; para cotizaciones y ventas, los productos y el total; para cobranzas, el importe y medio de pago.
- Se puede descargar en PDF ("Detalle diario (PDF)"), Word ("Detalle diario (Word)") o Excel ("Detalle diario (Excel)") con el mismo desglose por día.

### Ranking de productos por unidades vendidas y gráficos más modernos (Reportes)

- **Nuevo gráfico "Ranking de productos (por unidades vendidas)":** además del ranking de productos por facturación (U$), ahora hay un tercer gráfico en Reportes que ordena los productos por cantidad vendida (litros, bidones, dosis, bolsones, packs, etc., según la unidad de cada producto cargada en Configuración → Productos). El orden puede diferir del ranking por facturación: un producto de bajo precio unitario pero alto volumen puede aparecer más arriba acá aunque factura menos. El detalle al pasar el mouse muestra la cantidad con su unidad (por ejemplo "180 bidón 20L").
- **Barras más angostas en todos los gráficos de Reportes:** se achicó el grosor máximo de las barras (con un tope fijo en vez de estirarse para llenar el espacio) para un look más liviano y moderno, manteniendo las esquinas redondeadas ya existentes. Afecta a ventas por mes/año, evolución del pipeline, cartera (cobrado/pendiente), y los tres rankings.

### Editar oportunidades y porcentajes por etapa en el Pipeline

- **Editar una oportunidad:** en el tablero de Pipeline, cada tarjeta tiene un ícono de lápiz que abre un formulario para modificar título, cliente, importe estimado, probabilidad, etapa, responsable, próxima acción y fecha de cierre estimada. Antes solo se podía cambiar la etapa con el selector de la tarjeta; el resto de los datos quedaba fijo desde la creación.
- **Porcentaje por etapa:** el encabezado de cada columna del Pipeline ahora muestra, junto a la cantidad de oportunidades, qué porcentaje representa esa etapa sobre el total de oportunidades cargadas (por ejemplo "Cotización (2 · 25%)"). Sirve para ver de un vistazo dónde se concentra el pipeline comercial.

## Simplificaciones del prototipo (a reforzar antes de producción)

- La autenticación emite un JWT válido, pero los endpoints de negocio no verifican el token en cada request (solo `/auth/me` y la gestión de usuarios lo exigen). Para producción, aplicar el middleware `requireAuth`/`requireRole` a todas las rutas según el rol correspondiente.
- Los archivos subidos (adjuntos de clientes, importaciones) se guardan en el disco local del servidor; en producción conviene un storage externo (S3 o similar).
- La numeración de cotizaciones/ventas se basa en un contador simple; para un uso multiusuario concurrente conviene una secuencia atómica en base de datos.
- El motor de "inteligencia comercial" (sección 23 de la especificación) no está implementado; el modelo de datos ya soporta agregarlo (historial de ventas, frecuencia de compra, etc.) como una capa de análisis posterior.
