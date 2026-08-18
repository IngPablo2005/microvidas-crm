// Calcula el resumen semanal de actividad comercial: visitas, llamadas realizadas,
// ventas y cobranzas, tanto en totales como desagregado por responsable/vendedor.
// Se usa tanto para exponer los datos vía API como para generar el reporte
// descargable (PDF/Excel) desde el botón "Generar reporte semanal".
export async function getWeeklySummary(db, { desde, hasta } = {}) {
  desde = desde || (await db.prepare(`SELECT date('now', '-6 days') d`).get()).d;
  hasta = hasta || (await db.prepare(`SELECT date('now') d`).get()).d;

  const visitas = (await db.prepare(
    `SELECT COUNT(*) c FROM activities WHERE tipo = 'Visita' AND date(fecha) BETWEEN ? AND ?`
  ).get(desde, hasta)).c;

  const llamadas = (await db.prepare(
    `SELECT COUNT(*) c FROM activities WHERE tipo = 'Llamada' AND date(fecha) BETWEEN ? AND ?`
  ).get(desde, hasta)).c;

  const ventas = await db.prepare(
    `SELECT COUNT(*) c, COALESCE(SUM(total), 0) t FROM sales WHERE fecha BETWEEN ? AND ?`
  ).get(desde, hasta);

  const cobranzas = await db.prepare(
    `SELECT COUNT(*) c, COALESCE(SUM(importe), 0) t FROM collections WHERE fecha BETWEEN ? AND ?`
  ).get(desde, hasta);

  const actividadPorResp = await db.prepare(`
    SELECT usuario as responsable,
      SUM(CASE WHEN tipo = 'Visita' THEN 1 ELSE 0 END) visitas,
      SUM(CASE WHEN tipo = 'Llamada' THEN 1 ELSE 0 END) llamadas
    FROM activities
    WHERE date(fecha) BETWEEN ? AND ? AND tipo IN ('Visita', 'Llamada')
    GROUP BY usuario
  `).all(desde, hasta);

  const ventasPorVendedor = await db.prepare(`
    SELECT vendedor as responsable, COUNT(*) ventas_cantidad, COALESCE(SUM(total), 0) ventas_total
    FROM sales WHERE fecha BETWEEN ? AND ? GROUP BY vendedor
  `).all(desde, hasta);

  const cobranzasPorResp = await db.prepare(`
    SELECT responsable, COUNT(*) cobranzas_cantidad, COALESCE(SUM(importe), 0) cobranzas_total
    FROM collections WHERE fecha BETWEEN ? AND ? GROUP BY responsable
  `).all(desde, hasta);

  const map = {};
  function ensure(name) {
    const key = name || 'Sin asignar';
    if (!map[key]) {
      map[key] = { responsable: key, visitas: 0, llamadas: 0, ventas_cantidad: 0, ventas_total: 0, cobranzas_cantidad: 0, cobranzas_total: 0 };
    }
    return map[key];
  }
  actividadPorResp.forEach(r => { const m = ensure(r.responsable); m.visitas = r.visitas; m.llamadas = r.llamadas; });
  ventasPorVendedor.forEach(r => { const m = ensure(r.responsable); m.ventas_cantidad = r.ventas_cantidad; m.ventas_total = r.ventas_total; });
  cobranzasPorResp.forEach(r => { const m = ensure(r.responsable); m.cobranzas_cantidad = r.cobranzas_cantidad; m.cobranzas_total = r.cobranzas_total; });

  return {
    desde,
    hasta,
    totales: {
      visitas,
      llamadas,
      ventas_cantidad: ventas.c,
      ventas_total: ventas.t,
      cobranzas_cantidad: cobranzas.c,
      cobranzas_total: cobranzas.t,
    },
    porResponsable: Object.values(map).sort((a, b) => a.responsable.localeCompare(b.responsable)),
  };
}
