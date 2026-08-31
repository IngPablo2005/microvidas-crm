import express from 'express';
import db from '../db.js';
import { getWeeklySummary } from '../lib/weeklySummary.js';
import { getWeeklyDailyDetail } from '../lib/weeklyDailyDetail.js';
import { normalizeText } from '../helpers.js';

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

// Agrupa las líneas de venta por producto real, no por el texto tal cual quedó
// tipeado en cada venta. Antes se agrupaba directo por `si.descripcion`, así que
// un mismo producto vendido con mayúsculas/acentos/tipeo distinto en cada venta
// (ej. "Astarte N20", "ASTARTE N20", "Astarté N20") aparecía como varias filas
// separadas en el ranking en vez de una sola. Ahora:
// - si la línea está asociada a un producto del catálogo (`product_id`), se
//   agrupa por ese id y se muestra el nombre ACTUAL del catálogo (más confiable
//   que el texto suelto que haya quedado guardado en esa venta puntual);
// - si es un producto libre (sin `product_id`), se agrupa por el texto
//   normalizado (sin acentos, mayúsculas ni espacios de más), mostrando la
//   variante de texto más repetida como etiqueta.
// Esto no puede "adivinar" errores de tipeo que cambian letras de verdad (ej.
// "Astrate" en vez de "Astarte") sin arriesgarse a mezclar productos distintos
// por error — esos casos conviene corregirlos a mano en la venta o, si en
// realidad son productos duplicados cargados dos veces en el Catálogo, unificar
// el Catálogo (ver `unificarPor` más abajo).
async function rankingProductos(orderBy) {
  const rows = await db.prepare(`
    SELECT si.product_id, si.descripcion, si.cantidad, si.importe, p.nombre as producto_actual, p.unidad
    FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
  `).all();

  const groups = new Map();
  for (const r of rows) {
    const key = r.product_id ? `id:${r.product_id}` : `txt:${normalizeText(r.descripcion)}`;
    if (!groups.has(key)) {
      groups.set(key, { cantidad: 0, total: 0, unidad: r.unidad || 'unidades', label: r.producto_actual || r.descripcion, labelCounts: new Map() });
    }
    const g = groups.get(key);
    g.cantidad += Number(r.cantidad) || 0;
    g.total += Number(r.importe) || 0;
    if (!r.unidad) { /* no pisa una unidad ya conocida con el default */ } else { g.unidad = r.unidad; }
    if (!r.producto_actual) {
      // Sin producto de catálogo: nos quedamos con la variante de texto más
      // repetida dentro del grupo (ej. si "Fosfi Q" aparece más veces que
      // "fosfi q", se muestra "Fosfi Q").
      const label = (r.descripcion || '').trim() || '(sin nombre)';
      g.labelCounts.set(label, (g.labelCounts.get(label) || 0) + 1);
      let best = null, bestCount = -1;
      for (const [txt, count] of g.labelCounts) { if (count > bestCount) { best = txt; bestCount = count; } }
      g.label = best;
    }
  }

  const result = [...groups.values()].map(({ label, cantidad, total, unidad }) => ({ descripcion: label, cantidad, total, unidad }));
  result.sort((a, b) => (orderBy === 'cantidad' ? b.cantidad - a.cantidad : b.total - a.total));
  return result.slice(0, 10);
}

router.get('/ranking-productos', async (req, res) => {
  res.json(await rankingProductos('total'));
});

// Mismo agrupamiento que ranking-productos, pero ordenado por cantidad vendida
// (unidades/litros/packs, según el producto) en vez de por facturación — para el
// gráfico "Ranking de productos por unidades vendidas".
router.get('/ranking-productos-unidades', async (req, res) => {
  res.json(await rankingProductos('cantidad'));
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
