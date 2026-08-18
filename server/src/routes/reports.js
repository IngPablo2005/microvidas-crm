import express from 'express';
import db from '../db.js';
import { getWeeklySummary } from '../lib/weeklySummary.js';

const router = express.Router();

router.get('/weekly-summary', async (req, res) => {
  res.json(await getWeeklySummary(db));
});

router.get('/sales-weekly', async (req, res) => {
  const rows = await db.prepare(`SELECT fecha, SUM(total) importe FROM sales WHERE fecha >= date('now', '-7 days') GROUP BY fecha ORDER BY fecha`).all();
  res.json(rows);
});

router.get('/sales-monthly', async (req, res) => {
  const rows = await db.prepare(`SELECT strftime('%Y-%m', fecha) mes, SUM(total) importe FROM sales GROUP BY mes ORDER BY mes`).all();
  res.json(rows);
});

router.get('/sales-yearly', async (req, res) => {
  const rows = await db.prepare(`SELECT strftime('%Y', fecha) anio, SUM(total) importe FROM sales GROUP BY anio ORDER BY anio`).all();
  res.json(rows);
});

router.get('/pipeline-evolution', async (req, res) => {
  const rows = await db.prepare(`SELECT etapa, COUNT(*) cantidad, SUM(importe_estimado) valor FROM pipeline_opportunities GROUP BY etapa`).all();
  res.json(rows);
});

router.get('/conversion', async (req, res) => {
  const totalProspectos = (await db.prepare(`SELECT COUNT(*) c FROM prospects`).get()).c;
  const ganados = (await db.prepare(`SELECT COUNT(*) c FROM prospects WHERE estado = 'Ganado'`).get()).c;
  const totalCotizaciones = (await db.prepare(`SELECT COUNT(*) c FROM quotes`).get()).c;
  const aceptadas = (await db.prepare(`SELECT COUNT(*) c FROM quotes WHERE estado = 'Aceptada'`).get()).c;
  res.json({
    prospectos_a_clientes: totalProspectos ? Math.round((ganados / totalProspectos) * 100) : 0,
    cotizaciones_a_ventas: totalCotizaciones ? Math.round((aceptadas / totalCotizaciones) * 100) : 0,
    detalle: { totalProspectos, ganados, totalCotizaciones, aceptadas },
  });
});

router.get('/ranking-clientes', async (req, res) => {
  const rows = await db.prepare(`
    SELECT c.id, c.razon_social, SUM(s.total) total, COUNT(s.id) operaciones
    FROM sales s JOIN clients c ON c.id = s.client_id
    GROUP BY c.id ORDER BY total DESC LIMIT 10
  `).all();
  res.json(rows);
});

router.get('/ranking-productos', async (req, res) => {
  const rows = await db.prepare(`
    SELECT descripcion, SUM(cantidad) cantidad, SUM(importe) total
    FROM sale_items GROUP BY descripcion ORDER BY total DESC LIMIT 10
  `).all();
  res.json(rows);
});

router.get('/collections-weekly', async (req, res) => {
  res.json(await db.prepare(`SELECT fecha, SUM(importe) importe FROM collections WHERE fecha >= date('now', '-30 days') GROUP BY fecha ORDER BY fecha`).all());
});

router.get('/collections-monthly', async (req, res) => {
  res.json(await db.prepare(`SELECT strftime('%Y-%m', fecha) mes, SUM(importe) importe FROM collections GROUP BY mes ORDER BY mes`).all());
});

router.get('/collections-by-client', async (req, res) => {
  res.json(await db.prepare(`SELECT c.razon_social, SUM(col.importe) total FROM collections col JOIN clients c ON c.id = col.client_id GROUP BY c.id ORDER BY total DESC LIMIT 10`).all());
});

router.get('/collections-by-vendor', async (req, res) => {
  res.json(await db.prepare(`SELECT responsable, SUM(importe) total FROM collections GROUP BY responsable ORDER BY total DESC`).all());
});

router.get('/collections-by-method', async (req, res) => {
  res.json(await db.prepare(`SELECT medio_pago, SUM(importe) total, COUNT(*) cantidad FROM collections GROUP BY medio_pago ORDER BY total DESC`).all());
});

router.get('/debt-evolution', async (req, res) => {
  const vencido = (await db.prepare(`SELECT COALESCE(SUM(saldo),0) v FROM invoices WHERE estado = 'Vencida' AND saldo > 0`).get()).v;
  const cobrado = (await db.prepare(`SELECT COALESCE(SUM(importe),0) v FROM collections`).get()).v;
  const pendiente = (await db.prepare(`SELECT COALESCE(SUM(saldo),0) v FROM invoices WHERE saldo > 0 AND estado != 'Vencida'`).get()).v;
  res.json({ vencido, cobrado, pendiente });
});

export default router;
