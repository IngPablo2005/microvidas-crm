import db from './db.js';

export async function logActivity(clientId, tipo, descripcion, usuario, refTable = null, refId = null) {
  if (!clientId) return;
  await db.prepare(`INSERT INTO activities (client_id, tipo, descripcion, usuario, ref_table, ref_id) VALUES (?,?,?,?,?,?)`)
    .run(clientId, tipo, descripcion, usuario || 'Sistema', refTable, refId);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
