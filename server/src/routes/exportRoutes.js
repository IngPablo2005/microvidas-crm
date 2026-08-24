import express from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import db from '../db.js';
import { getWeeklySummary } from '../lib/weeklySummary.js';
import { getWeeklyDailyDetail } from '../lib/weeklyDailyDetail.js';

const router = express.Router();

const fmtMoney = n => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

function renderWeeklyReportPDF(res, summary) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_semanal_${summary.desde}_a_${summary.hasta}.pdf"`);
  doc.pipe(res);

  doc.fontSize(17).fillColor('#0f172a').text('Reporte semanal comercial', { align: 'center' });
  doc.fontSize(10).fillColor('#6b7280').text(`Período: ${summary.desde} al ${summary.hasta}`, { align: 'center' });
  doc.moveDown(1.2);

  const cards = [
    ['Visitas realizadas', summary.totales.visitas],
    ['Llamadas realizadas', summary.totales.llamadas],
    ['Ventas', `${summary.totales.ventas_cantidad} — ${fmtMoney(summary.totales.ventas_total)}`],
    ['Cobranzas', `${summary.totales.cobranzas_cantidad} — ${fmtMoney(summary.totales.cobranzas_total)}`],
  ];
  const cardWidth = (doc.page.width - 72) / 2;
  cards.forEach(([label, value], i) => {
    const x = 36 + (i % 2) * cardWidth;
    const y = doc.y + Math.floor(i / 2) * 52;
    doc.fontSize(9).fillColor('#6b7280').text(label, x, y);
    doc.fontSize(14).fillColor('#0f172a').text(String(value), x, y + 13);
  });
  doc.y += 52 * Math.ceil(cards.length / 2) + 10;
  doc.moveDown(1);

  doc.fontSize(12).fillColor('#0f172a').text('Detalle por responsable');
  doc.moveDown(0.4);

  const headers = ['Responsable', 'Visitas', 'Llamadas', 'Ventas (cant.)', 'Ventas (importe)', 'Cobranzas (cant.)', 'Cobranzas (importe)'];
  const colWidths = [110, 55, 60, 70, 90, 75, 90];
  let y = doc.y;
  doc.fontSize(8).fillColor('#374151');
  let x = 36;
  headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i]; });
  y += 14;
  doc.moveTo(36, y).lineTo(doc.page.width - 36, y).strokeColor('#d1d5db').stroke();
  y += 5;

  if (!summary.porResponsable.length) {
    doc.fontSize(9).fillColor('#9ca3af').text('Sin actividad registrada en el período.', 36, y);
  } else {
    doc.fontSize(8).fillColor('#111827');
    for (const r of summary.porResponsable) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
      const row = [r.responsable, String(r.visitas), String(r.llamadas), String(r.ventas_cantidad), fmtMoney(r.ventas_total), String(r.cobranzas_cantidad), fmtMoney(r.cobranzas_total)];
      x = 36;
      row.forEach((v, i) => { doc.text(v, x, y, { width: colWidths[i] }); x += colWidths[i]; });
      y += 14;
    }
  }

  doc.y = y + 16;
  doc.x = 36;
  doc.fontSize(7).fillColor('#9ca3af').text(`Generado el ${new Date().toISOString().slice(0, 10)}`);
  doc.end();
}

async function renderWeeklyReportXLSX(res, summary) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Resumen semanal');

  ws.addRow(['Reporte semanal comercial']);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([`Período: ${summary.desde} al ${summary.hasta}`]);
  ws.addRow([]);
  ws.addRow(['Visitas realizadas', summary.totales.visitas]);
  ws.addRow(['Llamadas realizadas', summary.totales.llamadas]);
  ws.addRow(['Ventas (cantidad)', summary.totales.ventas_cantidad]);
  ws.addRow(['Ventas (importe)', summary.totales.ventas_total]);
  ws.addRow(['Cobranzas (cantidad)', summary.totales.cobranzas_cantidad]);
  ws.addRow(['Cobranzas (importe)', summary.totales.cobranzas_total]);
  ws.addRow([]);

  const headerRowIdx = ws.rowCount + 1;
  ws.addRow(['Responsable', 'Visitas', 'Llamadas', 'Ventas (cant.)', 'Ventas (importe)', 'Cobranzas (cant.)', 'Cobranzas (importe)']);
  ws.getRow(headerRowIdx).font = { bold: true };
  for (const r of summary.porResponsable) {
    ws.addRow([r.responsable, r.visitas, r.llamadas, r.ventas_cantidad, r.ventas_total, r.cobranzas_cantidad, r.cobranzas_total]);
  }
  ws.columns.forEach(col => { col.width = 20; });

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_semanal_${summary.desde}_a_${summary.hasta}.xlsx"`);
  res.send(buffer);
}

router.get('/weekly-report', async (req, res) => {
  const format = req.query.format || 'pdf';
  const summary = await getWeeklySummary(db);
  if (format === 'xlsx') return renderWeeklyReportXLSX(res, summary);
  return renderWeeklyReportPDF(res, summary);
});

// Líneas de detalle "tal cual se cargó" para cada tipo de tarea diaria.
const CATEGORIAS_DETALLE = [
  { key: 'llamadas', label: 'Llamadas' },
  { key: 'visitas', label: 'Visitas' },
  { key: 'ensayos', label: 'Ensayos' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'cobranzas', label: 'Cobranzas' },
];

function lineasDeCategoria(key, items) {
  if (key === 'ventas') {
    return items.map(v => `${v.cliente}: Venta ${v.numero} — ${v.productos || 'sin productos'} — Total ${v.moneda} ${fmtMoney(v.total)}${v.observaciones ? ' — ' + v.observaciones : ''}`);
  }
  if (key === 'cobranzas') {
    return items.map(c => `${c.cliente}: ${c.moneda} ${fmtMoney(c.importe)} (${c.medio_pago})${c.comprobante ? ' — comp. ' + c.comprobante : ''}${c.observaciones ? ' — ' + c.observaciones : ''}`);
  }
  // llamadas, visitas, ensayos: el detalle escrito tal cual se cargó
  return items.map(a => `${a.cliente}: ${a.descripcion && a.descripcion.trim() ? a.descripcion : '(sin detalle escrito)'}${a.usuario ? ' — ' + a.usuario : ''}`);
}

function renderDailyDetailPDF(res, detail) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="tareas_diarias_${detail.lunes}_a_${detail.viernes}.pdf"`);
  doc.pipe(res);

  doc.fontSize(17).fillColor('#0f172a').text('Tareas diarias realizadas en la semana', { align: 'center' });
  doc.fontSize(10).fillColor('#6b7280').text(`Semana del ${detail.lunes} al ${detail.viernes}`, { align: 'center' });
  doc.moveDown(1);

  for (const dia of detail.dias) {
    if (doc.y > doc.page.height - 100) doc.addPage();
    doc.fontSize(13).fillColor('#0f172a').text(`${dia.diaSemana} — ${dia.fecha}`);
    doc.moveTo(36, doc.y + 2).lineTo(doc.page.width - 36, doc.y + 2).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.4);

    const totalItems = CATEGORIAS_DETALLE.reduce((s, c) => s + dia[c.key].length, 0);
    if (totalItems === 0) {
      doc.fontSize(9).fillColor('#9ca3af').text('Sin tareas registradas este día.');
    } else {
      for (const cat of CATEGORIAS_DETALLE) {
        const items = dia[cat.key];
        if (!items.length) continue;
        if (doc.y > doc.page.height - 60) doc.addPage();
        doc.fontSize(10).fillColor('#374151').text(`${cat.label} (${items.length})`);
        const lineas = lineasDeCategoria(cat.key, items);
        doc.fontSize(9).fillColor('#111827');
        for (const linea of lineas) {
          if (doc.y > doc.page.height - 50) doc.addPage();
          doc.text(`• ${linea}`, { indent: 10, width: doc.page.width - 82 });
        }
        doc.moveDown(0.3);
      }
    }
    doc.moveDown(0.6);
  }

  doc.fontSize(7).fillColor('#9ca3af').text(`Generado el ${new Date().toISOString().slice(0, 10)}`);
  doc.end();
}

async function renderDailyDetailXLSX(res, detail) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tareas diarias');

  ws.addRow(['Tareas diarias realizadas en la semana']);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([`Semana del ${detail.lunes} al ${detail.viernes}`]);
  ws.addRow([]);

  const headerRowIdx = ws.rowCount + 1;
  ws.addRow(['Día', 'Fecha', 'Categoría', 'Cliente', 'Detalle', 'Usuario / Responsable']);
  ws.getRow(headerRowIdx).font = { bold: true };

  for (const dia of detail.dias) {
    let algo = false;
    for (const cat of CATEGORIAS_DETALLE) {
      const items = dia[cat.key];
      for (const item of items) {
        algo = true;
        let cliente = item.cliente;
        let detalle, responsable;
        if (cat.key === 'ventas') {
          detalle = `Venta ${item.numero} — ${item.productos || 'sin productos'} — Total ${item.moneda} ${item.total}${item.observaciones ? ' — ' + item.observaciones : ''}`;
          responsable = item.vendedor;
        } else if (cat.key === 'cobranzas') {
          detalle = `${item.moneda} ${item.importe} (${item.medio_pago})${item.comprobante ? ' — comp. ' + item.comprobante : ''}${item.observaciones ? ' — ' + item.observaciones : ''}`;
          responsable = item.responsable;
        } else {
          detalle = item.descripcion && item.descripcion.trim() ? item.descripcion : '(sin detalle escrito)';
          responsable = item.usuario;
        }
        ws.addRow([dia.diaSemana, dia.fecha, cat.label, cliente, detalle, responsable || '']);
      }
    }
    if (!algo) ws.addRow([dia.diaSemana, dia.fecha, '—', '', 'Sin tareas registradas este día.', '']);
  }
  ws.columns.forEach((col, i) => { col.width = [10, 12, 12, 26, 55, 20][i] || 20; });

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="tareas_diarias_${detail.lunes}_a_${detail.viernes}.xlsx"`);
  res.send(buffer);
}

router.get('/weekly-daily-detail', async (req, res) => {
  const format = req.query.format || 'pdf';
  const detail = await getWeeklyDailyDetail(db, { desde: req.query.desde });
  if (format === 'xlsx') return renderDailyDetailXLSX(res, detail);
  return renderDailyDetailPDF(res, detail);
});

const QUERIES = {
  clients: `SELECT id, razon_social, nombre_comercial, cuit, contacto_principal, telefono, email, provincia, localidad, estado, potencial_comercial, responsable_comercial FROM clients ORDER BY razon_social`,
  prospects: `SELECT id, empresa, contacto, telefono, email, provincia, localidad, origen, potencial_estimado, estado, responsable FROM prospects ORDER BY empresa`,
  sales: `SELECT s.numero, c.razon_social as cliente, s.fecha, s.vendedor, si.descripcion as producto, si.cantidad, si.precio_unitario as precio_unitario_usd, si.importe as importe_usd, s.moneda, s.total as total_venta
          FROM sales s JOIN clients c ON c.id = s.client_id LEFT JOIN sale_items si ON si.sale_id = s.id ORDER BY s.fecha DESC, s.id, si.id`,
  quotes: `SELECT q.numero, c.razon_social as cliente, q.fecha, q.fecha_vencimiento, q.estado, q.responsable, qi.descripcion as producto, qi.cantidad, qi.precio_unitario as precio_unitario_usd, qi.importe as importe_usd, q.moneda, q.total as total_cotizacion
          FROM quotes q JOIN clients c ON c.id = q.client_id LEFT JOIN quote_items qi ON qi.quote_id = q.id ORDER BY q.fecha DESC, q.id, qi.id`,
  tasks: `SELECT t.titulo, c.razon_social as cliente, t.fecha, t.hora, t.prioridad, t.responsable, t.estado FROM tasks t LEFT JOIN clients c ON c.id = t.client_id ORDER BY t.fecha DESC`,
  activities: `SELECT a.fecha, c.razon_social as cliente, a.tipo, a.descripcion, a.usuario FROM activities a JOIN clients c ON c.id = a.client_id ORDER BY a.fecha DESC`,
  pipeline: `SELECT po.titulo, COALESCE(c.razon_social, p.empresa) as cliente_o_prospecto, po.etapa, po.importe_estimado, po.probabilidad, po.responsable, po.fecha_cierre_estimada FROM pipeline_opportunities po LEFT JOIN clients c ON c.id = po.client_id LEFT JOIN prospects p ON p.id = po.prospect_id`,
  milestones: `SELECT m.fecha, c.razon_social as cliente, m.tipo, m.descripcion FROM milestones m JOIN clients c ON c.id = m.client_id ORDER BY m.fecha DESC`,
  collections: `SELECT col.fecha, c.razon_social as cliente, col.comprobante, col.factura, col.importe, col.moneda, col.medio_pago, col.responsable FROM collections col JOIN clients c ON c.id = col.client_id ORDER BY col.fecha DESC`,
  invoices: `SELECT i.numero, c.razon_social as cliente, i.fecha, i.fecha_vencimiento, i.importe, i.saldo, i.estado FROM invoices i JOIN clients c ON c.id = i.client_id ORDER BY i.fecha_vencimiento`,
};

function rowsToCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  return lines.join('\n');
}

async function rowsToXLSXBuffer(sheetsData) {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheetsData)) {
    const ws = wb.addWorksheet(name.slice(0, 31));
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(headers.map(h => r[h]));
    ws.columns.forEach(col => { col.width = 20; });
  }
  return wb.xlsx.writeBuffer();
}

function rowsToPDF(res, title, rows) {
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown();
  if (!rows.length) { doc.fontSize(10).text('Sin datos.'); doc.end(); return; }
  const headers = Object.keys(rows[0]);
  const colWidth = (doc.page.width - 60) / headers.length;
  doc.fontSize(8);
  let y = doc.y;
  headers.forEach((h, i) => doc.text(String(h), 30 + i * colWidth, y, { width: colWidth }));
  y += 14;
  doc.moveTo(30, y).lineTo(doc.page.width - 30, y).stroke();
  y += 4;
  for (const row of rows) {
    if (y > doc.page.height - 40) { doc.addPage(); y = 40; }
    headers.forEach((h, i) => doc.text(String(row[h] ?? ''), 30 + i * colWidth, y, { width: colWidth }));
    y += 14;
  }
  doc.end();
}

router.get('/:entity', async (req, res) => {
  const { entity } = req.params;
  const format = req.query.format || 'xlsx';

  if (entity === 'all') {
    const sheets = {};
    for (const [name, query] of Object.entries(QUERIES)) sheets[name] = await db.prepare(query).all();
    const buffer = await rowsToXLSXBuffer(sheets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_export_completo.xlsx"');
    return res.send(buffer);
  }

  const query = QUERIES[entity];
  if (!query) return res.status(400).json({ error: 'Entidad no soportada para exportación' });
  const rows = await db.prepare(query).all();

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
    return res.send(rowsToCSV(rows));
  }
  if (format === 'pdf') {
    return rowsToPDF(res, entity, rows);
  }
  const buffer = await rowsToXLSXBuffer({ [entity]: rows });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${entity}.xlsx"`);
  res.send(buffer);
});

export default router;
