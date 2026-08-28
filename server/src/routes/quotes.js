import express from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { logActivity, genNumber } from '../helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'microvidas-logo.png');

const router = express.Router();

// Títulos por defecto de la tabla de productos de una cotización — se pueden
// sobrescribir por cotización (quotes.item_headers, guardado como JSON) para
// soportar el pedido de "poder editar títulos y celdas".
const DEFAULT_ITEM_HEADERS = {
  producto: 'Producto', cantidad: 'Cantidad', precio_lista: 'Precio lista',
  descuento: 'Desc. (%)', precio_desc: 'Precio c/desc', financiado: 'Financiado', subtotal: 'Subtotal',
};

function parseItemHeaders(raw) {
  if (!raw) return DEFAULT_ITEM_HEADERS;
  try { return { ...DEFAULT_ITEM_HEADERS, ...JSON.parse(raw) }; } catch { return DEFAULT_ITEM_HEADERS; }
}

function computeTotals(items, descuentoGeneral = 0) {
  let subtotal = 0;
  let totalFinanciado = 0;
  const computed = (items || []).slice(0, 5).map(it => {
    const importe = Number(it.cantidad) * Number(it.precio_unitario) * (1 - (Number(it.descuento) || 0) / 100);
    subtotal += importe;
    totalFinanciado += Number(it.cantidad) * (Number(it.financiado) || 0);
    return { ...it, importe };
  });
  const total = subtotal * (1 - (Number(descuentoGeneral) || 0) / 100);
  return { computed, subtotal, total, totalFinanciado };
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
  res.json({ ...quote, item_headers: parseItemHeaders(quote.item_headers), items });
});

router.post('/', async (req, res) => {
  const { client_id, fecha, fecha_vencimiento, moneda, descuento_general, items, probabilidad_cierre, responsable, observaciones, condiciones_comerciales, item_headers, usuario } = req.body;
  const { computed, subtotal, total, totalFinanciado } = computeTotals(items || [], descuento_general);
  const numero = await genNumber('COT', 'quotes');
  const id = (await db.prepare(`INSERT INTO quotes (numero, client_id, fecha, fecha_vencimiento, moneda, descuento_general, subtotal, total, total_financiado, probabilidad_cierre, estado, responsable, observaciones, condiciones_comerciales, item_headers)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    numero, client_id, fecha || new Date().toISOString().slice(0, 10), fecha_vencimiento, moneda || 'USD',
    descuento_general || 0, subtotal, total, totalFinanciado, probabilidad_cierre || 50, 'Borrador', responsable, observaciones,
    condiciones_comerciales || null, item_headers ? JSON.stringify(item_headers) : null
  )).lastInsertRowid;
  const insItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, descripcion, cantidad, precio_unitario, descuento, financiado, importe) VALUES (?,?,?,?,?,?,?,?)');
  for (const it of computed) await insItem.run(id, it.product_id || null, it.descripcion, it.cantidad, it.precio_unitario, it.descuento || 0, it.financiado || 0, it.importe);
  await logActivity(client_id, 'Cotizacion', `Cotización ${numero} creada por ${moneda || 'USD'} ${total.toFixed(2)}.`, usuario, 'quotes', id);
  res.status(201).json({ id, numero });
});

// Edita una cotización existente: reemplaza los productos (hasta 5) y recalcula
// totales. Cualquier campo del header que no se envíe conserva su valor anterior
// (evita que falte un campo y la actualización falle).
router.put('/:id', async (req, res) => {
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

  const { fecha, fecha_vencimiento, moneda, descuento_general, items, probabilidad_cierre, responsable, observaciones, condiciones_comerciales, item_headers, usuario } = req.body;
  const { computed, subtotal, total, totalFinanciado } = computeTotals(items || [], descuento_general ?? quote.descuento_general);

  await db.prepare(`UPDATE quotes SET fecha=?, fecha_vencimiento=?, moneda=?, descuento_general=?, subtotal=?, total=?, total_financiado=?, probabilidad_cierre=?, responsable=?, observaciones=?, condiciones_comerciales=?, item_headers=?, updated_at=datetime('now') WHERE id=?`)
    .run(
      fecha || quote.fecha,
      fecha_vencimiento ?? quote.fecha_vencimiento,
      moneda || quote.moneda,
      descuento_general ?? quote.descuento_general ?? 0,
      subtotal, total, totalFinanciado,
      probabilidad_cierre ?? quote.probabilidad_cierre,
      responsable ?? quote.responsable,
      observaciones ?? quote.observaciones,
      condiciones_comerciales ?? quote.condiciones_comerciales,
      item_headers ? JSON.stringify(item_headers) : quote.item_headers,
      req.params.id
    );
  await db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
  const insItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, descripcion, cantidad, precio_unitario, descuento, financiado, importe) VALUES (?,?,?,?,?,?,?,?)');
  for (const it of computed) await insItem.run(req.params.id, it.product_id || null, it.descripcion, it.cantidad, it.precio_unitario, it.descuento || 0, it.financiado || 0, it.importe);
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

const GREEN = '#1e5f3c';
const GREEN_LIGHT = '#5c8f74';
const fmtMoney = (n, moneda = 'USD') => `${moneda} ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Genera un PDF de la cotización con un formato inspirado en las cotizaciones
// comerciales de Microvidas (encabezado en verde, tabla de productos, total,
// condiciones comerciales y pie con la leyenda de validez) — sin los campos de
// hectáreas/dosis por ha del formato original, que no aplican a este cotizador.
router.get('/:id/pdf', async (req, res) => {
  const quote = await db.prepare(`SELECT q.*, c.razon_social as cliente_nombre FROM quotes q JOIN clients c ON c.id = q.client_id WHERE q.id = ?`).get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
  const items = await db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
  const headers = parseItemHeaders(quote.item_headers);
  const moneda = quote.moneda || 'USD';

  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Cotizacion_${quote.numero}.pdf"`);
  doc.pipe(res);

  const left = 30, right = doc.page.width - 30;

  // Encabezado — logo real de Microvidas (en vez del texto "MICROVIDAS" simulado)
  try {
    doc.image(LOGO_PATH, left, 26, { height: 34 });
  } catch {
    // si el archivo del logo no está disponible, no se corta la generación del PDF
    doc.fontSize(18).fillColor(GREEN).font('Helvetica-Bold').text('MICROVIDAS', left, 32);
    doc.fontSize(8).fillColor(GREEN_LIGHT).font('Helvetica').text('AGROBIOTECNOLOGÍA', left, 52);
  }
  doc.fontSize(20).fillColor(GREEN).font('Helvetica-Bold').text('Cotización', left, 30, { align: 'right', width: right - left });
  doc.fontSize(9).fillColor('#6b7280').font('Helvetica').text(new Date(quote.fecha).toLocaleDateString('es-AR'), left, 56, { align: 'right', width: right - left });

  doc.moveTo(left, 78).lineTo(right, 78).strokeColor('#d1d5db').stroke();

  // Título con la empresa destinataria — a quién se le está cotizando
  let y = 90;
  doc.fontSize(9).fillColor('#9ca3af').font('Helvetica').text('EMPRESA', left, y);
  y += 12;
  doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold').text(quote.cliente_nombre || '—', left, y);
  y += 22;

  // Datos de la cotización
  doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold').text('N°:', left, y);
  doc.font('Helvetica').text(quote.numero, left + 25, y);
  doc.font('Helvetica-Bold').text('Validez:', left + 150, y);
  doc.font('Helvetica').text(quote.fecha_vencimiento ? new Date(quote.fecha_vencimiento).toLocaleDateString('es-AR') : 'A convenir', left + 195, y);
  doc.font('Helvetica-Bold').text('Vendedor:', left + 330, y);
  doc.font('Helvetica').text(quote.responsable || '—', left + 385, y);
  y += 24;

  // Tabla de productos — Producto | Cantidad | Precio lista | Precio c/desc | Financiado | Subtotal
  const cols = [
    { key: 'producto', w: 150, align: 'left' },
    { key: 'cantidad', w: 55, align: 'right' },
    { key: 'precio_lista', w: 75, align: 'right' },
    { key: 'precio_desc', w: 75, align: 'right' },
    { key: 'financiado', w: 75, align: 'right' },
    { key: 'subtotal', w: 95, align: 'right' },
  ];
  const tableWidth = cols.reduce((s, c) => s + c.w, 0);

  function drawHeaderRow(yy) {
    doc.rect(left, yy, tableWidth, 20).fill(GREEN);
    let x = left;
    doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica-Bold');
    for (const c of cols) {
      // lineBreak: false evita que un título largo (los títulos son editables) empuje
      // el texto a una segunda línea y desborde la franja verde del encabezado.
      doc.text(headers[c.key].toUpperCase(), x + 4, yy + 6, { width: c.w - 8, align: c.align, lineBreak: false, ellipsis: true });
      x += c.w;
    }
    return yy + 20;
  }

  y = drawHeaderRow(y);

  doc.font('Helvetica').fontSize(9);
  for (const it of items) {
    if (y > doc.page.height - 160) { doc.addPage(); y = 40; y = drawHeaderRow(y); }
    const rowH = 22;
    const precioDesc = Number(it.precio_unitario) * (1 - (Number(it.descuento) || 0) / 100);
    const vals = [
      it.descripcion || '',
      Number(it.cantidad).toLocaleString('es-AR'),
      fmtMoney(it.precio_unitario, moneda),
      fmtMoney(precioDesc, moneda),
      it.financiado ? fmtMoney(it.financiado, moneda) : '—',
      fmtMoney(it.importe, moneda),
    ];
    let x = left;
    doc.fillColor('#1f2937');
    vals.forEach((v, i) => {
      doc.text(String(v), x + 4, y + 6, { width: cols[i].w - 8, align: cols[i].align });
      x += cols[i].w;
    });
    doc.moveTo(left, y + rowH).lineTo(left + tableWidth, y + rowH).strokeColor('#e5e7eb').stroke();
    y += rowH;
  }

  // Totales — se calcula el ancho exacto de cada string (en vez de confiar en un
  // ancho de columna fijo) para que "TOTAL" y el monto nunca se superpongan ni
  // se corten, sea cual sea la magnitud del número.
  y += 16;
  function drawTotalLine(label, value, labelSize, valueSize, color) {
    doc.font('Helvetica-Bold').fontSize(valueSize).fillColor(color);
    const valueStr = fmtMoney(value, moneda);
    const valueW = doc.widthOfString(valueStr);
    doc.text(valueStr, left + tableWidth - valueW, y, { lineBreak: false });
    doc.fontSize(labelSize).text(label, left, y + (valueSize - labelSize) / 2 + 1, { width: tableWidth - valueW - 10, align: 'right', lineBreak: false });
    y += valueSize + 8;
  }
  drawTotalLine('TOTAL', quote.total, 10, 16, GREEN);
  if (quote.total_financiado > 0) drawTotalLine('TOTAL FINANCIADO', quote.total_financiado, 8, 11, '#6b7280');

  // Condiciones comerciales
  if (quote.condiciones_comerciales) {
    y += 10;
    doc.fontSize(9).fillColor(GREEN).font('Helvetica-Bold').text('Condiciones comerciales', left, y);
    y += 14;
    doc.fontSize(8.5).fillColor('#374151').font('Helvetica').text(quote.condiciones_comerciales, left, y, { width: tableWidth });
    y = doc.y + 10;
  }

  if (quote.observaciones) {
    doc.fontSize(8.5).fillColor('#6b7280').font('Helvetica-Oblique').text(quote.observaciones, left, y, { width: tableWidth });
    y = doc.y + 10;
  }

  // Pie
  const footerY = Math.max(y + 10, doc.page.height - 90);
  doc.moveTo(left, footerY).lineTo(right, footerY).dash(2, { space: 2 }).strokeColor('#d1d5db').stroke();
  doc.undash();
  doc.fontSize(7.5).fillColor('#9ca3af').font('Helvetica').text(
    `Precios expresados en ${moneda}, más IVA si correspondiera. Cotización sujeta a disponibilidad de stock. Los valores son válidos por el plazo de vigencia indicado a partir de la fecha de emisión.`,
    left, footerY + 8, { width: tableWidth - 140 }
  );
  doc.fontSize(7.5).fillColor('#9ca3af').text(`Asesor comercial: ${quote.responsable || '—'}`, left + tableWidth - 140, footerY + 8, { width: 140, align: 'right' });

  doc.end();
});

export default router;
