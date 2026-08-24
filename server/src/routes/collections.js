import express from 'express';
import db from '../db.js';
import { logActivity } from '../helpers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { client_id, vendedor, medio_pago, fecha_desde, fecha_hasta } = req.query;
  let sql = `SELECT col.*, c.razon_social as cliente_nombre FROM collections col JOIN clients c ON c.id = col.client_id WHERE 1=1`;
  const params = [];
  if (client_id) { sql += ' AND col.client_id = ?'; params.push(client_id); }
  if (vendedor) { sql += ' AND col.responsable = ?'; params.push(vendedor); }
  if (medio_pago) { sql += ' AND col.medio_pago = ?'; params.push(medio_pago); }
  if (fecha_desde) { sql += ' AND col.fecha >= ?'; params.push(fecha_desde); }
  if (fecha_hasta) { sql += ' AND col.fecha <= ?'; params.push(fecha_hasta); }
  sql += ' ORDER BY col.fecha DESC, col.id DESC';
  res.json(await db.prepare(sql).all(...params));
});

router.post('/', async (req, res) => {
  const c = req.body;
  const id = (await db.prepare(`INSERT INTO collections (client_id, fecha, comprobante, factura, importe, moneda, medio_pago, fecha_vencimiento_original, responsable, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    c.client_id, c.fecha || new Date().toISOString().slice(0, 10), c.comprobante ?? null, c.factura ?? null, c.importe || 0,
    c.moneda || 'USD', c.medio_pago || 'Transferencia bancaria', c.fecha_vencimiento_original ?? null, c.responsable ?? null, c.observaciones ?? null
  )).lastInsertRowid;
  // Aplicar contra factura si corresponde
  if (c.invoice_id) {
    const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(c.invoice_id);
    if (inv) {
      const nuevoSaldo = Math.max(0, inv.saldo - Number(c.importe || 0));
      const estado = nuevoSaldo === 0 ? 'Pagada' : inv.estado;
      await db.prepare('UPDATE invoices SET saldo = ?, estado = ? WHERE id = ?').run(nuevoSaldo, estado, c.invoice_id);
    }
  }
  await logActivity(c.client_id, 'Cobranza', `Cobranza registrada por ${c.moneda || 'USD'} ${Number(c.importe || 0).toFixed(2)} (${c.medio_pago}).`, c.usuario, 'collections', id);
  res.status(201).json({ id });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Cuenta corriente por cliente
router.get('/account/:clientId', async (req, res) => {
  const clientId = req.params.clientId;
  const invoices = await db.prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY fecha DESC').all(clientId);
  const collections = await db.prepare('SELECT * FROM collections WHERE client_id = ? ORDER BY fecha DESC').all(clientId);
  const totalFacturado = invoices.reduce((s, i) => s + i.importe, 0);
  const totalCobrado = totalFacturado - invoices.reduce((s, i) => s + i.saldo, 0);
  const totalVencido = invoices.filter(i => i.estado === 'Vencida').reduce((s, i) => s + i.saldo, 0);
  const totalPendiente = invoices.reduce((s, i) => s + i.saldo, 0);
  const ultimaCobranza = collections[0] || null;
  const proximoVencimiento = invoices.filter(i => i.saldo > 0).sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0] || null;
  const vencidas = invoices.filter(i => i.estado === 'Vencida' && i.saldo > 0);
  const diasPromedioAtraso = vencidas.length
    ? Math.round(vencidas.reduce((s, i) => s + Math.max(0, Math.floor((Date.now() - new Date(i.fecha_vencimiento)) / 86400000)), 0) / vencidas.length)
    : 0;

  const movimientos = [
    ...invoices.map(i => ({ fecha: i.fecha, tipo: 'Factura', comprobante: i.numero, importe: i.importe, saldo: i.saldo, moneda: i.moneda, estado: i.estado })),
    ...collections.map(c => ({ fecha: c.fecha, tipo: 'Cobranza', comprobante: c.comprobante, importe: -c.importe, moneda: c.moneda, medio_pago: c.medio_pago })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  res.json({
    totalFacturado, totalCobrado, totalVencido, totalPendiente,
    ultimaCobranza, proximoVencimiento, diasPromedioAtraso,
    saldo: totalFacturado - totalCobrado,
    estadoSaldo: totalVencido > 0 ? 'Deuda vencida' : totalPendiente > 0 ? 'Saldo pendiente' : 'Al día',
    invoices, collections, movimientos,
  });
});

// Compromisos de pago
router.get('/commitments', async (req, res) => {
  const { client_id, estado } = req.query;
  let sql = `SELECT pc.*, c.razon_social as cliente_nombre FROM payment_commitments pc JOIN clients c ON c.id = pc.client_id WHERE 1=1`;
  const params = [];
  if (client_id) { sql += ' AND pc.client_id = ?'; params.push(client_id); }
  if (estado) { sql += ' AND pc.estado = ?'; params.push(estado); }
  sql += ' ORDER BY pc.fecha_comprometida ASC';
  res.json(await db.prepare(sql).all(...params));
});

router.post('/commitments', async (req, res) => {
  const p = req.body;
  const id = (await db.prepare(`INSERT INTO payment_commitments (client_id, importe_comprometido, moneda, fecha_comprometida, invoice_id, responsable, observaciones, estado)
    VALUES (?,?,?,?,?,?,?,?)`).run(p.client_id, p.importe_comprometido, p.moneda || 'USD', p.fecha_comprometida ?? null, p.invoice_id || null, p.responsable ?? null, p.observaciones ?? null, 'Pendiente')).lastInsertRowid;
  await logActivity(p.client_id, 'Cobranza', `Compromiso de pago registrado por ${p.moneda || 'USD'} ${Number(p.importe_comprometido).toFixed(2)} para el ${p.fecha_comprometida}.`, p.responsable, 'payment_commitments', id);
  res.status(201).json({ id });
});

router.patch('/commitments/:id/estado', async (req, res) => {
  const { estado } = req.body;
  await db.prepare('UPDATE payment_commitments SET estado = ? WHERE id = ?').run(estado, req.params.id);
  res.json({ ok: true });
});

// Facturas
router.get('/invoices', async (req, res) => {
  const { client_id, estado } = req.query;
  let sql = `SELECT i.*, c.razon_social as cliente_nombre FROM invoices i JOIN clients c ON c.id = i.client_id WHERE 1=1`;
  const params = [];
  if (client_id) { sql += ' AND i.client_id = ?'; params.push(client_id); }
  if (estado) { sql += ' AND i.estado = ?'; params.push(estado); }
  sql += ' ORDER BY i.fecha_vencimiento ASC';
  res.json(await db.prepare(sql).all(...params));
});

export default router;
