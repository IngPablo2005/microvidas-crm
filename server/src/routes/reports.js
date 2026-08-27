import express from 'express';
import db from '../db.js';
import { getWeeklySummary } from '../lib/weeklySummary.js';
import { getWeeklyDailyDetail } from '../lib/weeklyDailyDetail.js';

const router = express.Router();

router.get('/weekly-summary', async (req, res) => {
  res.json(await getWeeklySummary(db));
});

// Detalle día por día (Lunes a Viernes) de llamadas, visitas, ventas, cobranzas y
// ensayos de la semana, con el texto tal cual fue cargado. Opcionalmente recibe
// "desde" (un lunes en formato YYYY-MM-DD) para ver una semana distinta a la actual.
router.get('/weekly-daily-detail', async (req, res) => {
  res.json(await getWeeklyDailyDetail(db, { desde: req.query.desde }));
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
    SELECT si.descripcion, SUM(si.cantidad) cantidad, SUM(si.importe) total,
      COALESCE(MAX(p.unidad), 'unidades') as unidad
    FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
    GROUP BY si.descripcion ORDER BY total DESC LIMIT 10
  `).all();
  res.json(rows);
});

// Mismo agrupamiento que ranking-productos, pero ordenado por cantidad vendida
// (unidades/litros/packs, según el producto) en vez de por facturación — para el
// gráfico "Ranking de productos por unidades vendidas".
router.get('/ranking-productos-unidades', async (req, res) => {
  const rows = await db.prepare(`
    SELECT si.descripcion, SUM(si.cantidad) cantidad, SUM(si.importe) total,
      COALESCE(MAX(p.unidad), 'unidades') as unidad
    FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
    GROUP BY si.descripcion ORDER BY cantidad DESC LIMIT 10
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
