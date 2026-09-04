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
  const id = (await db.prepare(`INSERT INTO collections (client_id, fecha, comprobante, factura, importe, moneda, medio_pago, fecha_vencimiento_original, responsable, observaciones, invoice_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    c.client_id, c.fecha || new Date().toISOString().slice(0, 10), c.comprobante ?? null, c.factura ?? null, c.importe || 0,
    c.moneda || 'USD', c.medio_pago || 'Transferencia bancaria', c.fecha_vencimiento_original ?? null, c.responsable ?? null, c.observaciones ?? null,
    c.invoice_id || null
  )).lastInsertRowid;
  // Aplicar contra factura si corresponde (se guarda invoice_id en la cobranza
  // para poder deshacer este mismo ajuste si más adelante se edita o se borra).
  await ajustarSaldoFactura(c.invoice_id, c.importe, -1);
  await logActivity(c.client_id, 'Cobranza', `Cobranza registrada por ${c.moneda || 'USD'} ${Number(c.importe || 0).toFixed(2)} (${c.medio_pago}).`, c.usuario, 'collections', id);
  res.status(201).json({ id });
});

// Aplica (o reaplica) el efecto de una cobranza sobre el saldo de la factura a
// la que está asociada. signo = -1 para aplicarla (resta del saldo, lo que
// hace POST /) y +1 para deshacerla (se la devuelve al saldo, primer paso de
// PUT /:id antes de aplicar los valores nuevos). Nunca dispara si no hay
// invoice_id — las cobranzas sin factura asociada no tocan ningún saldo.
async function ajustarSaldoFactura(invoiceId, importe, signo) {
  if (!invoiceId) return;
  const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!inv) return;
  const nuevoSaldo = Math.max(0, Math.min(inv.importe, inv.saldo + signo * Number(importe || 0)));
  // Si el saldo vuelve a quedar en positivo (ej. se deshace una cobranza que la
  // había dejado en 0/"Pagada"), el estado vuelve a "Pendiente" — salvo que ya
  // estuviera en otro estado manual (ej. no debería pisar "Vencida" al revés,
  // pero acá no se puede saber la fecha de vencimiento sin otra consulta, así
  // que sólo se corrige el caso más común: "Pagada" con saldo > 0 no tiene sentido).
  const estado = nuevoSaldo === 0 ? 'Pagada' : (inv.estado === 'Pagada' ? 'Pendiente' : inv.estado);
  await db.prepare('UPDATE invoices SET saldo = ?, estado = ? WHERE id = ?').run(nuevoSaldo, estado, invoiceId);
}

// Edita una cobranza ya cargada. Si estaba (o queda) asociada a una factura,
// se recalcula el saldo de esa factura en dos pasos: primero se le devuelve lo
// que la cobranza vieja le había restado, después se le vuelve a restar el
// importe nuevo — así cambiar el importe, la factura asociada, o directamente
// desvincularla, deja el saldo de cualquier factura involucrada consistente
// (en vez de ir arrastrando el desajuste, que es lo que pasaría si sólo se
// aplicara la diferencia sin pasar por este ida y vuelta).
router.put('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cobranza no encontrada' });
  const c = req.body;

  await ajustarSaldoFactura(existing.invoice_id, existing.importe, +1);

  await db.prepare(`UPDATE collections SET fecha=?, comprobante=?, factura=?, importe=?, moneda=?, medio_pago=?, fecha_vencimiento_original=?, responsable=?, observaciones=? WHERE id=?`)
    .run(
      c.fecha || existing.fecha,
      c.comprobante ?? existing.comprobante,
      c.factura ?? existing.factura,
      c.importe ?? existing.importe,
      c.moneda ?? existing.moneda,
      c.medio_pago ?? existing.medio_pago,
      c.fecha_vencimiento_original ?? existing.fecha_vencimiento_original,
      c.responsable ?? existing.responsable,
      c.observaciones ?? existing.observaciones,
      req.params.id
    );

  const invoiceIdNuevo = c.invoice_id !== undefined ? (c.invoice_id || null) : existing.invoice_id;
  await ajustarSaldoFactura(invoiceIdNuevo, c.importe ?? existing.importe, -1);
  if (invoiceIdNuevo !== existing.invoice_id) {
    await db.prepare('UPDATE collections SET invoice_id = ? WHERE id = ?').run(invoiceIdNuevo, req.params.id);
  }

  await logActivity(existing.client_id, 'Cobranza', `Cobranza editada: ${c.moneda ?? existing.moneda} ${Number(c.importe ?? existing.importe).toFixed(2)} (${c.medio_pago ?? existing.medio_pago}).`, c.usuario, 'collections', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  // Al borrar una cobranza que estaba aplicada a una factura, se le devuelve el
  // saldo — si no, la factura queda "cobrada" de más y nunca se puede volver a
  // registrar bien esa cobranza.
  if (existing) await ajustarSaldoFactura(existing.invoice_id, existing.importe, +1);
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
