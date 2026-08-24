import express from 'express';
import db from '../db.js';
import { logActivity, genNumber } from '../helpers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { client_id, vendedor, producto, provincia, localidad, fecha_desde, fecha_hasta, anio, mes, q } = req.query;
  let sql = `SELECT s.*, c.razon_social as cliente_nombre, c.provincia, c.localidad FROM sales s JOIN clients c ON c.id = s.client_id WHERE 1=1`;
  const params = [];
  if (client_id) { sql += ' AND s.client_id = ?'; params.push(client_id); }
  if (vendedor) { sql += ' AND s.vendedor = ?'; params.push(vendedor); }
  if (provincia) { sql += ' AND c.provincia = ?'; params.push(provincia); }
  if (localidad) { sql += ' AND c.localidad = ?'; params.push(localidad); }
  if (fecha_desde) { sql += ' AND s.fecha >= ?'; params.push(fecha_desde); }
  if (fecha_hasta) { sql += ' AND s.fecha <= ?'; params.push(fecha_hasta); }
  if (anio) { sql += " AND strftime('%Y', s.fecha) = ?"; params.push(String(anio)); }
  if (mes) { sql += " AND strftime('%m', s.fecha) = ?"; params.push(String(mes).padStart(2, '0')); }
  if (q) { sql += ' AND (s.numero LIKE ? OR c.razon_social LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY s.fecha DESC, s.id DESC';
  let rows = await db.prepare(sql).all(...params);
  if (producto) {
    const ids = rows.map(r => r.id);
    if (ids.length) {
      const withProd = new Set((await db.prepare(`SELECT DISTINCT sale_id FROM sale_items WHERE descripcion LIKE ? AND sale_id IN (${ids.map(() => '?').join(',')})`).all(`%${producto}%`, ...ids)).map(r => r.sale_id));
      rows = rows.filter(r => withProd.has(r.id));
    }
  }
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const sale = await db.prepare(`SELECT s.*, c.razon_social as cliente_nombre FROM sales s JOIN clients c ON c.id = s.client_id WHERE s.id = ?`).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  const items = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ ...sale, items });
});

router.post('/', async (req, res) => {
  const { client_id, quote_id, fecha, moneda, items, vendedor, observaciones, usuario } = req.body;
  let total = 0;
  const computed = (items || []).slice(0, 5).map(it => {
    const importe = Number(it.cantidad) * Number(it.precio_unitario);
    total += importe;
    return { ...it, importe };
  });
  const numero = await genNumber('VTA', 'sales');
  const id = (await db.prepare(`INSERT INTO sales (numero, client_id, quote_id, fecha, moneda, total, vendedor, observaciones) VALUES (?,?,?,?,?,?,?,?)`)
    .run(numero, client_id, quote_id || null, fecha || new Date().toISOString().slice(0, 10), moneda || 'USD', total, vendedor, observaciones)).lastInsertRowid;
  const insItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, descripcion, cantidad, precio_unitario, importe) VALUES (?,?,?,?,?,?)');
  for (const it of computed) await insItem.run(id, it.product_id || null, it.descripcion, it.cantidad, it.precio_unitario, it.importe);
  await logActivity(client_id, 'Venta', `Venta ${numero} registrada por ${moneda || 'USD'} ${total.toFixed(2)}.`, usuario, 'sales', id);
  const existing = await db.prepare(`SELECT id FROM milestones WHERE client_id = ? AND tipo = 'Primera venta'`).get(client_id);
  if (!existing) await db.prepare(`INSERT INTO milestones (client_id, tipo, descripcion, fecha) VALUES (?,?,?,date('now'))`).run(client_id, 'Primera venta', `Primera venta registrada (${numero}).`);
  // Crear factura pendiente asociada (30 días)
  await db.prepare(`INSERT INTO invoices (client_id, sale_id, numero, fecha, fecha_vencimiento, importe, moneda, saldo, estado) VALUES (?,?,?,?, date(?, '+30 days'),?,?,?,'Pendiente')`)
    .run(client_id, id, numero.replace('VTA', 'FC'), fecha || new Date().toISOString().slice(0, 10), fecha || new Date().toISOString().slice(0, 10), total, moneda || 'USD', total);
  res.status(201).json({ id, numero });
});

// Edita una venta existente: reemplaza los productos (hasta 5, validado también en el
// frontend) y recalcula el total. Si la venta tiene una factura asociada, ajusta su
// importe y saldo por la diferencia, preservando lo que ya se haya cobrado.
router.put('/:id', async (req, res) => {
  const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const { fecha, moneda, items, vendedor, observaciones, usuario } = req.body;
  const itemsLimitados = (items || []).slice(0, 5);
  let total = 0;
  const computed = itemsLimitados.map(it => {
    const importe = Number(it.cantidad) * Number(it.precio_unitario);
    total += importe;
    return { ...it, importe };
  });

  await db.prepare(`UPDATE sales SET fecha=?, moneda=?, total=?, vendedor=?, observaciones=? WHERE id=?`)
    .run(fecha || sale.fecha, moneda || sale.moneda, total, vendedor ?? sale.vendedor, observaciones ?? sale.observaciones, req.params.id);

  await db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(req.params.id);
  const insItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, descripcion, cantidad, precio_unitario, importe) VALUES (?,?,?,?,?,?)');
  for (const it of computed) await insItem.run(req.params.id, it.product_id || null, it.descripcion, it.cantidad, it.precio_unitario, it.importe);

  const invoice = await db.prepare('SELECT * FROM invoices WHERE sale_id = ?').get(req.params.id);
  if (invoice) {
    const pagado = invoice.importe - invoice.saldo;
    const nuevoSaldo = Math.max(0, total - pagado);
    const nuevoEstado = nuevoSaldo <= 0 ? 'Pagada' : (invoice.estado === 'Vencida' ? 'Vencida' : 'Pendiente');
    await db.prepare('UPDATE invoices SET importe=?, saldo=?, estado=? WHERE id=?').run(total, nuevoSaldo, nuevoEstado, invoice.id);
  }

  await logActivity(sale.client_id, 'Venta', `Venta ${sale.numero} editada. Nuevo total: ${moneda || sale.moneda} ${total.toFixed(2)}.`, usuario, 'sales', sale.id);
  res.json({ ok: true, total });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM invoices WHERE sale_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
