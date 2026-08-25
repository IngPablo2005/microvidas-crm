// Detalle día por día (Lunes a Viernes) de las tareas comerciales realizadas en la
// semana: llamadas, visitas y ensayos (tabla "activities", con el detalle escrito tal
// cual se cargó), más cotizaciones, ventas y cobranzas del día. Se usa en Reportes →
// "Tareas diarias de la semana" y en su exportación a PDF/Excel/Word.

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function nombreDia(fechaISO) {
  return DIAS_SEMANA[new Date(`${fechaISO}T00:00:00`).getDay()];
}

export async function getWeeklyDailyDetail(db, { desde } = {}) {
  // Lunes de la semana a mostrar: el parámetro "desde" si se pasa, o el lunes de la
  // semana actual (si hoy es sábado o domingo, cae en la semana que recién terminó).
  const lunes = desde || (await db.prepare(`
    SELECT date('now', 'weekday 0', '-6 days') d
  `).get()).d;

  const dias = [];
  for (let i = 0; i < 5; i++) {
    const fecha = (await db.prepare(`SELECT date(?, '+' || ? || ' days') d`).get(lunes, i)).d;

    const llamadas = await db.prepare(`
      SELECT a.id, c.id as client_id, c.razon_social as cliente, a.descripcion, a.usuario, a.fecha
      FROM activities a JOIN clients c ON c.id = a.client_id
      WHERE a.tipo = 'Llamada' AND date(a.fecha) = ? ORDER BY a.fecha
    `).all(fecha);

    const visitas = await db.prepare(`
      SELECT a.id, c.id as client_id, c.razon_social as cliente, a.descripcion, a.usuario, a.fecha
      FROM activities a JOIN clients c ON c.id = a.client_id
      WHERE a.tipo = 'Visita' AND date(a.fecha) = ? ORDER BY a.fecha
    `).all(fecha);

    const ensayos = await db.prepare(`
      SELECT a.id, c.id as client_id, c.razon_social as cliente, a.descripcion, a.usuario, a.fecha
      FROM activities a JOIN clients c ON c.id = a.client_id
      WHERE a.tipo = 'Ensayo' AND date(a.fecha) = ? ORDER BY a.fecha
    `).all(fecha);

    const cotizaciones = await db.prepare(`
      SELECT q.id, q.numero, c.id as client_id, c.razon_social as cliente, q.responsable, q.moneda, q.total, q.estado, q.observaciones,
        (SELECT GROUP_CONCAT(qi.descripcion || ' (x' || qi.cantidad || ')', ', ') FROM quote_items qi WHERE qi.quote_id = q.id) as productos
      FROM quotes q JOIN clients c ON c.id = q.client_id
      WHERE q.fecha = ? ORDER BY q.id
    `).all(fecha);

    const ventas = await db.prepare(`
      SELECT s.id, s.numero, c.id as client_id, c.razon_social as cliente, s.vendedor, s.moneda, s.total, s.observaciones,
        (SELECT GROUP_CONCAT(si.descripcion || ' (x' || si.cantidad || ')', ', ') FROM sale_items si WHERE si.sale_id = s.id) as productos
      FROM sales s JOIN clients c ON c.id = s.client_id
      WHERE s.fecha = ? ORDER BY s.id
    `).all(fecha);

    const cobranzas = await db.prepare(`
      SELECT col.id, c.id as client_id, c.razon_social as cliente, col.importe, col.moneda, col.medio_pago, col.comprobante, col.observaciones, col.responsable
      FROM collections col JOIN clients c ON c.id = col.client_id
      WHERE col.fecha = ? ORDER BY col.id
    `).all(fecha);

    dias.push({ fecha, diaSemana: nombreDia(fecha), llamadas, visitas, ensayos, cotizaciones, ventas, cobranzas });
  }

  return { lunes, viernes: dias[4].fecha, dias };
}
