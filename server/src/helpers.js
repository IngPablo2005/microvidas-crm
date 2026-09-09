import db from './db.js';

export async function logActivity(clientId, tipo, descripcion, usuario, refTable = null, refId = null) {
  if (!clientId) return;
  await db.prepare(`INSERT INTO activities (client_id, tipo, descripcion, usuario, ref_table, ref_id) VALUES (?,?,?,?,?,?)`)
    .run(clientId, tipo, descripcion, usuario || 'Sistema', refTable, refId);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Determina el estado real de una factura EN EL MOMENTO DE LA CONSULTA,
// comparando saldo y fecha de vencimiento contra hoy — en vez de depender de
// un valor "Vencida" grabado de una vez en la base, que quedaría
// desactualizado apenas se editara la fecha de vencimiento o pasara el
// tiempo (agregado 9/9/2026, junto con poder editar el vencimiento de una
// factura). "Pagada" es la única condición que sigue viniendo de la base:
// se decide al registrar/deshacer una cobranza, no por fecha. Comparación de
// strings porque fecha_vencimiento se guarda como "aaaa-mm-dd" (ordena igual
// que Date, sin el riesgo de corrimiento de huso horario de pasar por Date()).
// Suma días a una fecha "sola" (aaaa-mm-dd, sin hora) armando el resultado con
// UTC en vez de pasar por el reloj/huso horario del servidor — evita el mismo
// corrimiento de día documentado arriba en fmtFechaAR si se usara `new
// Date("aaaa-mm-dd")` directamente (se interpreta como medianoche UTC).
export function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

export function estadoFactura(inv) {
  if (inv.saldo <= 0) return 'Pagada';
  const hoy = todayStr();
  if (inv.fecha_vencimiento && inv.fecha_vencimiento.slice(0, 10) < hoy) return 'Vencida';
  return 'Pendiente';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Formatea una fecha como dd/mm/aaaa para el PDF de cotizaciones y el reporte
// semanal. Igual que en el frontend (UI.jsx), si el valor es una fecha "sola"
// sin hora (ej. "2026-09-04", como se guardan fecha/fecha_vencimiento de
// cotizaciones y las fechas del reporte semanal) se arma el string
// directamente en vez de pasar por new Date(), para no arriesgarse a un
// corrimiento de día si el servidor corriera en un huso horario negativo.
export function fmtFechaAR(d) {
  if (!d) return '';
  const soloFecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (soloFecha) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// Quita acentos y diferencias de mayúsculas/espacios para poder agrupar texto
// cargado a mano (ej. nombres de producto escritos "a ojo" en una venta) sin que
// "Fosfi Q" y "fosfi q" o "Astarté N20" y "Astarte N20" cuenten como cosas
// distintas. Mismo criterio que se usa en el buscador de clientes del frontend
// (ClientPicker.jsx), replicado acá para los rankings de productos.
export function normalizeText(str) {
  return (str || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
}

// Parsea la tabla pegada desde Word/Excel de una cotización (quotes.tabla_pegada,
// guardada como JSON de un array de filas, cada fila un array de celdas de
// texto). Devuelve siempre un array de arrays de string, nunca revienta con un
// JSON corrupto o vacío.
export function parseTablaPegada(raw) {
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(row => Array.isArray(row))
      .map(row => row.map(cell => (cell === null || cell === undefined) ? '' : String(cell)));
  } catch {
    return [];
  }
}

// Parsea las imágenes pegadas (Ctrl+V) en "Información adicional" de una
// cotización (quotes.imagenes_pegadas, guardada como JSON de un array de data
// URLs en base64, ya redimensionadas y convertidas a JPEG en el navegador
// antes de guardarse). Devuelve siempre un array de strings, filtrando
// cualquier valor que no sea un data URL de imagen válido, nunca revienta con
// un JSON corrupto o vacío.
export function parseImagenesPegadas(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(s => typeof s === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(s));
  } catch {
    return [];
  }
}

export async function paginate(query, params, page = 1, pageSize = 50) {
  const offset = (page - 1) * pageSize;
  return db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
}

// Genera el próximo número correlativo (ej. "COT-2026-1008") para cotizaciones o
// ventas. Antes se basaba en COUNT(*) de la tabla, lo que rompía en cuanto se
// borraba cualquier registro que no fuera el último: el conteo bajaba, el próximo
// número generado coincidía con uno que ya existía, y el INSERT fallaba con
// "UNIQUE constraint failed: quotes.numero" — un error 500 sin manejar en el
// frontend, que hacía parecer que el botón "Crear cotización" no hacía nada.
// Ahora se calcula a partir del correlativo MÁS ALTO ya usado ese año (no de la
// cantidad de filas), y si aun así hay colisión (ej. dos creaciones casi
// simultáneas) se reintenta unas pocas veces antes de usar un sufijo de emergencia.
export async function genNumber(prefix, table) {
  const year = new Date().getFullYear();
  const likePattern = `${prefix}-${year}-%`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await db.prepare(`SELECT numero FROM ${table} WHERE numero LIKE ?`).all(likePattern);
    let max = 1000;
    for (const r of rows) {
      const n = Number(String(r.numero).split('-').pop());
      if (Number.isFinite(n) && n > max) max = n;
    }
    const candidate = `${prefix}-${year}-${max + 1}`;
    const exists = await db.prepare(`SELECT 1 FROM ${table} WHERE numero = ?`).get(candidate);
    if (!exists) return candidate;
  }
  // Salida de emergencia (prácticamente nunca debería llegar acá): un sufijo único
  // en vez de fallar la creación por completo.
  return `${prefix}-${year}-${Date.now().toString().slice(-6)}`;
}
