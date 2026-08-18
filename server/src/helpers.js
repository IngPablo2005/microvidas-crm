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

export async function genNumber(prefix, table) {
  const row = await db.prepare(`SELECT COUNT(*) c FROM ${table}`).get();
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(1000 + row.c + 1)}`;
}
