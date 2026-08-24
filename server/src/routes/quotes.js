import express from 'express';
import db from '../db.js';
import { logActivity, genNumber } from '../helpers.js';

const router = express.Router();

function computeTotals(items, descuentoGeneral = 0) {
  let subtotal = 0;
  const computed = (items || []).slice(0, 5).map(it => {
    const importe = Number(it.cantidad) * Number(it.precio_unitario) * (1 - (Number(it.descuento) || 0) / 100);
    subtotal += importe;
    return { ...it, importe };
  });
  const total = subtotal * (1 - (Number(descuentoGeneral) || 0) / 100);
  return { computed, subtotal, total };
}

router.get('/', async (req, res) => {
  const { client_id, estado, q } = req.query;
  let sql = `SELECT q.*, c.razon_social as cliente_nombre FROM quotes q JOIN clients c ON c.id = q.client_id WHERE 1=1`;
  const params = [];
  if (client_id) { sql += ' AND q.client_id = ?'; params.push(client_id); }
  if (estado) { sql += ' AND q.estado = ?'; params.push(estado); }
  if (q) { sql += ' AND (q.numero LIKE ? OR c.razon_social LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY q.fecha DESC, q.id DESC';
  res.json(await db.prepare(sql).all(...params));
});

router.get('/:id', async (req, res) => {
  const quote = await db.prepare(`SELECT q.*, c.razon_social as cliente_nombre FROM quotes q JOIN clients c ON c.id = q.client_id WHERE q.id = ?`).get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
  const items = await db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
  res.json({ ...quote, items });
});

router.post('/', async (req, res) => {
  const { client_id, fecha, fecha_vencimiento, moneda, descuento_general, items, probabilidad_cierre, responsable, observaciones, usuario } = req.body;
  const { computed, subtotal, total } = computeTotals(items || [], descuento_general);
  const numero = await genNumber('COT', 'quotes');
  const id = (await db.prepare(`INSERT INTO quotes (numero, client_id, fecha, fecha_vencimiento, moneda, descuento_general, subtotal, total, probabilidad_cierre, estado, responsable, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    numero, client_id, fecha || new Date().toISOString().slice(0, 10), fecha_vencimiento, moneda || 'USD',
    descuento_general || 0, subtotal, total, probabilidad_cierre || 50, 'Borrador', responsable, observaciones
  )).lastInsertRowid;
  const insItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, descripcion, cantidad, precio_unitario, descuento, importe) VALUES (?,?,?,?,?,?,?)');
  for (const it of computed) await insItem.run(id, it.product_id || null, it.descripcion, it.cantidad, it.precio_unitario, it.descuento || 0, it.importe);
  await logActivity(client_id, 'Cotizacion', `Cotización ${numero} creada por ${moneda || 'USD'} ${total.toFixed(2)}.`, usuario, 'quotes', id);
  res.status(201).json({ id, numero });
});

// Edita una cotización existente: reemplaza los productos (hasta 5) y recalcula
// totales. Cualquier campo del header que no se envíe conserva su valor anterior
// (evita que falte un campo y la actualización falle).
router.put('/:id', async (req, res) => {
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

  const { fecha, fecha_vencimiento, moneda, descuento_general, items, probabilidad_cierre, responsable, observaciones, usuario } = req.body;
  const { computed, subtotal, total } = computeTotals(items || [], descuento_general ?? quote.descuento_general);

  await db.prepare(`UPDATE quotes SET fecha=?, fecha_vencimiento=?, moneda=?, descuento_general=?, subtotal=?, total=?, probabilidad_cierre=?, responsable=?, observaciones=?, updated_at=datetime('now') WHERE id=?`)
    .run(
      fecha || quote.fecha,
      fecha_vencimiento ?? quote.fecha_vencimiento,
      moneda || quote.moneda,
      descuento_general ?? quote.descuento_general ?? 0,
      subtotal, total,
      probabilidad_cierre ?? quote.probabilidad_cierre,
      responsable ?? quote.responsable,
      observaciones ?? quote.observaciones,
      req.params.id
    );
  await db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
  const insItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, descripcion, cantidad, precio_unitario, descuento, importe) VALUES (?,?,?,?,?,?,?)');
  for (const it of computed) await insItem.run(req.params.id, it.product_id || null, it.descripcion, it.cantidad, it.precio_unitario, it.descuento || 0, it.importe);
  await logActivity(quote.client_id, 'Cotizacion', `Cotización ${quote.numero} editada. Nuevo total: ${moneda || quote.moneda} ${total.toFixed(2)}.`, usuario, 'quotes', quote.id);
  res.json({ ok: true, subtotal, total });
});

router.patch('/:id/estado', async (req, res) => {
  const { estado, usuario } = req.body;
  const valid = ['Borrador', 'Enviada', 'En negociacion', 'Aceptada', 'Rechazada', 'Vencida'];
  if (!valid.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  await db.prepare(`UPDATE quotes SET estado=?, updated_at=datetime('now') WHERE id=?`).run(estado, req.params.id);
  await logActivity(quote.client_id, 'Cotizacion', `Cotización ${quote.numero} cambió a estado "${estado}".`, usuario, 'quotes', req.params.id);
  res.json({ ok: true });
});

// Convertir cotización aceptada en venta
router.post('/:id/convert-to-sale', async (req, res) => {
  const { usuario, vendedor } = req.body;
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
  const items = await db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
  const numero = await genNumber('VTA', 'sales');
  const saleId = (await db.prepare(`INSERT INTO sales (numero, client_id, quote_id, fecha, moneda, total, vendedor, observaciones) VALUES (?,?,?,date('now'),?,?,?,?)`)
    .run(numero, quote.client_id, quote.id, quote.moneda, quote.total, vendedor || quote.responsable, `Generada desde cotización ${quote.numero}`)).lastInsertRowid;
  const insItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, descripcion, cantidad, precio_unitario, importe) VALUES (?,?,?,?,?,?)');
  for (const it of items) await insItem.run(saleId, it.product_id, it.descripcion, it.cantidad, it.precio_unitario, it.importe);
  await db.prepare(`UPDATE quotes SET estado='Aceptada', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  await logActivity(quote.client_id, 'Venta', `Venta ${numero} generada desde cotización ${quote.numero} por ${quote.moneda} ${quote.total.toFixed(2)}.`, usuario, 'sales', saleId);
  const existing = await db.prepare(`SELECT id FROM milestones WHERE client_id = ? AND tipo = 'Primera venta'`).get(quote.client_id);
  if (!existing) await db.prepare(`INSERT INTO milestones (client_id, tipo, descripcion, fecha) VALUES (?,?,?,date('now'))`).run(quote.client_id, 'Primera venta', `Primera venta registrada (${numero}).`);
  res.status(201).json({ saleId, numero });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
