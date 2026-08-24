import express from 'express';
import db from '../db.js';

const router = express.Router();
const today = () => new Date().toISOString().slice(0, 10);

async function getSetting(key, fallback) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? Number(row.value) : fallback;
}

router.get('/', async (req, res) => {
  const t = today();

  // Tareas de hoy
  const tareasHoy = (await db.prepare(`SELECT COUNT(*) c FROM tasks WHERE fecha = ? AND estado NOT IN ('Completada')`).get(t)).c;
  const tareasVencidas = (await db.prepare(`SELECT COUNT(*) c FROM tasks WHERE fecha < ? AND estado NOT IN ('Completada')`).get(t)).c;
  const tareasCompletadas = (await db.prepare(`SELECT COUNT(*) c FROM tasks WHERE fecha = ? AND estado = 'Completada'`).get(t)).c;
  const proximaTarea = await db.prepare(`
    SELECT tk.*, c.razon_social as cliente_nombre FROM tasks tk LEFT JOIN clients c ON c.id = tk.client_id
    WHERE tk.fecha >= ? AND tk.estado NOT IN ('Completada') ORDER BY tk.fecha ASC, tk.hora ASC LIMIT 1
  `).get(t);

  // Ventas del día
  const ventasHoy = await db.prepare(`SELECT COALESCE(SUM(total),0) importe, COUNT(*) ops, COUNT(DISTINCT client_id) clientes FROM sales WHERE fecha = ?`).get(t);

  // Ventas del mes vs mes anterior
  const mesActual = t.slice(0, 7);
  const mesAnteriorDate = new Date(t); mesAnteriorDate.setMonth(mesAnteriorDate.getMonth() - 1);
  const mesAnterior = mesAnteriorDate.toISOString().slice(0, 7);
  const ventasMes = (await db.prepare(`SELECT COALESCE(SUM(total),0) importe FROM sales WHERE strftime('%Y-%m', fecha) = ?`).get(mesActual)).importe;
  const ventasMesAnterior = (await db.prepare(`SELECT COALESCE(SUM(total),0) importe FROM sales WHERE strftime('%Y-%m', fecha) = ?`).get(mesAnterior)).importe;
  const objetivoMensual = await getSetting('objetivo_mensual_usd', 60000);

  // Ventas semana / año
  const semanaInicio = new Date(t); semanaInicio.setDate(semanaInicio.getDate() - semanaInicio.getDay());
  const ventasSemana = (await db.prepare(`SELECT COALESCE(SUM(total),0) importe FROM sales WHERE fecha >= ?`).get(semanaInicio.toISOString().slice(0, 10))).importe;
  const anioActual = t.slice(0, 4);
  const ventasAnio = (await db.prepare(`SELECT COALESCE(SUM(total),0) importe FROM sales WHERE strftime('%Y', fecha) = ?`).get(anioActual)).importe;

  // Cotizaciones abiertas
  const abiertas = ['Borrador', 'Enviada', 'En negociacion'];
  const cotAbiertas = await db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total),0) valor FROM quotes WHERE estado IN (${abiertas.map(() => '?').join(',')})`).get(...abiertas);
  const cotProxVencer = (await db.prepare(`SELECT COUNT(*) c FROM quotes WHERE estado IN (${abiertas.map(() => '?').join(',')}) AND fecha_vencimiento BETWEEN ? AND date(?, '+7 days')`).get(...abiertas, t, t)).c;
  const cotVencidas = (await db.prepare(`SELECT COUNT(*) c FROM quotes WHERE estado = 'Vencida' OR (estado IN (${abiertas.map(() => '?').join(',')}) AND fecha_vencimiento < ?)`).get(...abiertas, t)).c;

  // Prospectos
  const totalProspectos = (await db.prepare(`SELECT COUNT(*) c FROM prospects WHERE estado NOT IN ('Ganado','Perdido')`).get()).c;
  const nuevosProspectos = (await db.prepare(`SELECT COUNT(*) c FROM prospects WHERE estado = 'Nuevo'`).get()).c;
  const enSeguimiento = (await db.prepare(`SELECT COUNT(*) c FROM prospects WHERE estado IN ('Contactado','Calificado','Cotizacion','Negociacion')`).get()).c;
  const altaProb = (await db.prepare(`SELECT COUNT(*) c FROM prospects WHERE probabilidad >= 50 AND estado NOT IN ('Ganado','Perdido')`).get()).c;

  // Pipeline por etapa
  const pipelinePorEtapa = await db.prepare(`SELECT etapa, COUNT(*) cantidad, COALESCE(SUM(importe_estimado),0) valor FROM pipeline_opportunities GROUP BY etapa`).all();

  // Clientes
  const clientesActivos = (await db.prepare(`SELECT COUNT(*) c FROM clients WHERE estado = 'Activo'`).get()).c;
  const nuevosClientes = (await db.prepare(`SELECT COUNT(*) c FROM clients WHERE fecha_alta >= date(?, '-30 days')`).get(t)).c;

  // Conversión
  const totalClientesHist = (await db.prepare(`SELECT COUNT(*) c FROM clients`).get()).c;
  const prospectosGanados = (await db.prepare(`SELECT COUNT(*) c FROM prospects WHERE estado = 'Ganado'`).get()).c;
  const totalProspectosHist = (await db.prepare(`SELECT COUNT(*) c FROM prospects`).get()).c;
  const tasaConversionProspectos = totalProspectosHist ? Math.round((prospectosGanados / totalProspectosHist) * 100) : 0;
  const cotAceptadas = (await db.prepare(`SELECT COUNT(*) c FROM quotes WHERE estado = 'Aceptada'`).get()).c;
  const totalCotizaciones = (await db.prepare(`SELECT COUNT(*) c FROM quotes`).get()).c;
  const tasaConversionCotizaciones = totalCotizaciones ? Math.round((cotAceptadas / totalCotizaciones) * 100) : 0;

  // Cobranzas
  const cobradoHoy = (await db.prepare(`SELECT COALESCE(SUM(importe),0) v FROM collections WHERE fecha = ?`).get(t)).v;
  const cobradoSemana = (await db.prepare(`SELECT COALESCE(SUM(importe),0) v FROM collections WHERE fecha >= ?`).get(semanaInicio.toISOString().slice(0, 10))).v;
  const cobradoMes = (await db.prepare(`SELECT COALESCE(SUM(importe),0) v FROM collections WHERE strftime('%Y-%m', fecha) = ?`).get(mesActual)).v;
  const cobradoAnio = (await db.prepare(`SELECT COALESCE(SUM(importe),0) v FROM collections WHERE strftime('%Y', fecha) = ?`).get(anioActual)).v;
  const cuentasACobrar = (await db.prepare(`SELECT COALESCE(SUM(saldo),0) v FROM invoices WHERE saldo > 0`).get()).v;
  const vencido = (await db.prepare(`SELECT COALESCE(SUM(saldo),0) v FROM invoices WHERE estado = 'Vencida' AND saldo > 0`).get()).v;
  const proximosVencimientos = (await db.prepare(`SELECT COALESCE(SUM(saldo),0) v FROM invoices WHERE saldo > 0 AND fecha_vencimiento BETWEEN ? AND date(?, '+7 days')`).get(t, t)).v;

  res.json({
    tareas: { hoy: tareasHoy, vencidas: tareasVencidas, completadas: tareasCompletadas, proxima: proximaTarea || null },
    ventas: { hoy: ventasHoy.importe, ops_hoy: ventasHoy.ops, clientes_hoy: ventasHoy.clientes, semana: ventasSemana, mes: ventasMes, mes_anterior: ventasMesAnterior, anio: ventasAnio, objetivo_mensual: objetivoMensual, cumplimiento_pct: objetivoMensual ? Math.round((ventasMes / objetivoMensual) * 100) : 0 },
    cotizaciones: { abiertas: cotAbiertas.c, valor_abiertas: cotAbiertas.valor, proximas_vencer: cotProxVencer, vencidas: cotVencidas },
    prospectos: { total: totalProspectos, nuevos: nuevosProspectos, en_seguimiento: enSeguimiento, alta_probabilidad: altaProb },
    pipeline: pipelinePorEtapa,
    clientes: { activos: clientesActivos, nuevos: nuevosClientes },
    conversion: { prospectos_pct: tasaConversionProspectos, cotizaciones_pct: tasaConversionCotizaciones },
    cobranzas: { hoy: cobradoHoy, semana: cobradoSemana, mes: cobradoMes, anio: cobradoAnio, cuentas_a_cobrar: cuentasACobrar, vencido, proximos_vencimientos: proximosVencimientos },
  });
});

router.get('/alerts', async (req, res) => {
  const t = today();
  const diasSinContacto = await getSetting('dias_sin_contacto_alerta', 30);
  const alerts = [];

  const tareasVencidas = await db.prepare(`SELECT tk.id, tk.titulo, tk.fecha, c.razon_social FROM tasks tk LEFT JOIN clients c ON c.id = tk.client_id WHERE tk.fecha < ? AND tk.estado NOT IN ('Completada')`).all(t);
  for (const task of tareasVencidas) alerts.push({ tipo: 'Tarea vencida', severidad: 'alta', mensaje: `${task.titulo}${task.razon_social ? ' — ' + task.razon_social : ''} (vencida el ${task.fecha})`, client_id: task.client_id, ref: 'tasks', ref_id: task.id });

  const cotVencer = await db.prepare(`SELECT q.id, q.numero, q.total, q.fecha_vencimiento, c.razon_social, c.id as client_id FROM quotes q JOIN clients c ON c.id = q.client_id WHERE q.estado IN ('Borrador','Enviada','En negociacion') AND q.fecha_vencimiento BETWEEN ? AND date(?, '+7 days')`).all(t, t);
  for (const q of cotVencer) alerts.push({ tipo: 'Cotización próxima a vencer', severidad: 'media', mensaje: `Cotización ${q.numero} de ${q.razon_social} por USD ${q.total.toFixed(2)} vence el ${q.fecha_vencimiento}`, client_id: q.client_id, ref: 'quotes', ref_id: q.id });

  const cotAltoValor = await db.prepare(`SELECT q.id, q.numero, q.total, c.razon_social, c.id as client_id FROM quotes q JOIN clients c ON c.id = q.client_id WHERE q.estado IN ('Borrador','Enviada','En negociacion') AND q.total >= 15000`).all();
  for (const q of cotAltoValor) alerts.push({ tipo: 'Cotización de alto valor', severidad: 'media', mensaje: `Cotización ${q.numero} de ${q.razon_social} por USD ${q.total.toFixed(2)}`, client_id: q.client_id, ref: 'quotes', ref_id: q.id });

  // Clientes sin una llamada o visita registrada (tabla "activities", tipos Visita/Llamada)
  // en los últimos N días configurados en Configuración ("Días sin llamadas o visitas para alertar").
  const sinContacto = await db.prepare(`
    SELECT * FROM (
      SELECT c.id, c.razon_social,
        (SELECT MAX(date(a.fecha)) FROM activities a WHERE a.client_id = c.id AND a.tipo IN ('Visita','Llamada')) as ultima_llamada_visita
      FROM clients c WHERE c.estado = 'Activo'
    ) t
    WHERE ultima_llamada_visita IS NULL OR ultima_llamada_visita <= date(?, '-' || ? || ' days')
  `).all(t, diasSinContacto);
  for (const c of sinContacto) {
    const detalle = c.ultima_llamada_visita ? `última: ${c.ultima_llamada_visita}` : 'nunca se registró una';
    alerts.push({ tipo: 'Sin llamadas ni visitas', severidad: 'media', mensaje: `${c.razon_social} sin llamadas ni visitas hace más de ${diasSinContacto} días (${detalle})`, client_id: c.id, ref: 'clients', ref_id: c.id });
  }

  const prospectosSinSeguimiento = await db.prepare(`SELECT id, empresa, proximo_contacto FROM prospects WHERE estado NOT IN ('Ganado','Perdido') AND proximo_contacto IS NOT NULL AND proximo_contacto < ?`).all(t);
  for (const p of prospectosSinSeguimiento) alerts.push({ tipo: 'Prospecto sin seguimiento', severidad: 'media', mensaje: `${p.empresa} — seguimiento vencido (${p.proximo_contacto})`, ref: 'prospects', ref_id: p.id });

  const altaProb = await db.prepare(`SELECT po.id, po.titulo, po.probabilidad, po.importe_estimado, c.razon_social, c.id as client_id FROM pipeline_opportunities po LEFT JOIN clients c ON c.id = po.client_id WHERE po.probabilidad >= 60 AND po.etapa NOT IN ('Ganada','Perdida')`).all();
  for (const o of altaProb) alerts.push({ tipo: 'Oportunidad con alta probabilidad', severidad: 'baja', mensaje: `${o.titulo} (${o.probabilidad}% — USD ${o.importe_estimado.toFixed(2)})`, client_id: o.client_id, ref: 'pipeline', ref_id: o.id });

  const deudaVencida = await db.prepare(`
    SELECT c.id, c.razon_social, SUM(i.saldo) deuda, MIN(i.fecha_vencimiento) vto_antiguo
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.estado = 'Vencida' AND i.saldo > 0 GROUP BY c.id
  `).all();
  for (const d of deudaVencida) {
    const diasAtraso = Math.floor((Date.now() - new Date(d.vto_antiguo)) / 86400000);
    alerts.push({ tipo: 'Cliente con deuda vencida', severidad: 'alta', mensaje: `${d.razon_social} — Deuda vencida: USD ${d.deuda.toFixed(2)} (vencimiento más antiguo: ${diasAtraso} días)`, client_id: d.id, ref: 'clients', ref_id: d.id });
  }

  const compromisosIncumplidos = await db.prepare(`SELECT pc.id, pc.importe_comprometido, c.razon_social, c.id as client_id FROM payment_commitments pc JOIN clients c ON c.id = pc.client_id WHERE pc.estado = 'Incumplido'`).all();
  for (const p of compromisosIncumplidos) alerts.push({ tipo: 'Compromiso de pago incumplido', severidad: 'alta', mensaje: `${p.razon_social} no cumplió compromiso de pago por USD ${p.importe_comprometido.toFixed(2)}`, client_id: p.client_id, ref: 'payment_commitments', ref_id: p.id });

  const proxVencimientos = await db.prepare(`SELECT i.id, i.numero, i.saldo, i.fecha_vencimiento, c.razon_social, c.id as client_id FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.saldo > 0 AND i.fecha_vencimiento BETWEEN ? AND date(?, '+7 days')`).all(t, t);
  for (const i of proxVencimientos) alerts.push({ tipo: 'Próximo vencimiento de cobranza', severidad: 'media', mensaje: `Factura ${i.numero} de ${i.razon_social} por USD ${i.saldo.toFixed(2)} vence el ${i.fecha_vencimiento}`, client_id: i.client_id, ref: 'invoices', ref_id: i.id });

  const severidadOrden = { alta: 0, media: 1, baja: 2 };
  alerts.sort((a, b) => severidadOrden[a.severidad] - severidadOrden[b.severidad]);
  res.json(alerts);
});

router.get('/settings', async (req, res) => {
  const rows = await db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.put('/settings', async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
  }
  res.json({ ok: true });
});

export default router;
