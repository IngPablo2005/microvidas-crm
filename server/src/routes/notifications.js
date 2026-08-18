import express from 'express';
import db from '../db.js';

const router = express.Router();

const REMINDER_MINUTES = {
  '5 minutos antes': 5,
  '15 minutos antes': 15,
  '30 minutos antes': 30,
  '1 hora antes': 60,
  '1 dia antes': 24 * 60,
  Personalizado: 30,
  Ninguno: 0,
};

function eventDateTime(fecha, hora) {
  return new Date(`${fecha}T${hora && /^\d{2}:\d{2}/.test(hora) ? hora : '09:00'}:00`);
}

async function alreadyNotified(refTable, refId) {
  return !!(await db.prepare('SELECT id FROM notifications WHERE ref_table = ? AND ref_id = ?').get(refTable, refId));
}

async function insertNotification({ tipo, mensaje, client_id, ref_table, ref_id }) {
  await db.prepare(`INSERT INTO notifications (tipo, mensaje, client_id, ref_table, ref_id) VALUES (?,?,?,?,?)`)
    .run(tipo, mensaje, client_id || null, ref_table, ref_id);
}

// Revisa eventos de calendario y tareas programadas, y genera notificaciones nuevas
// para los recordatorios que ya deberían haberse disparado.
async function scanForDueReminders() {
  const now = new Date();

  const events = await db.prepare(`
    SELECT e.*, c.razon_social as cliente_nombre FROM calendar_events e
    LEFT JOIN clients c ON c.id = e.client_id
    WHERE e.estado != 'Completada' AND e.fecha >= date('now', '-1 day') AND e.fecha <= date('now', '+2 day')
  `).all();

  for (const ev of events) {
    if (await alreadyNotified('calendar_events', ev.id)) continue;
    const dt = eventDateTime(ev.fecha, ev.hora);
    const offsetMin = REMINDER_MINUTES[ev.recordatorio] ?? 0;
    const triggerAt = new Date(dt.getTime() - offsetMin * 60000);
    if (now >= triggerAt) {
      const cuando = ev.recordatorio && ev.recordatorio !== 'Ninguno' ? `(${ev.recordatorio})` : '';
      await insertNotification({
        tipo: 'Recordatorio de evento',
        mensaje: `${ev.titulo} — ${ev.tipo} programado para ${ev.fecha} ${ev.hora || ''} ${cuando}${ev.cliente_nombre ? ' · ' + ev.cliente_nombre : ''}`.trim(),
        client_id: ev.client_id,
        ref_table: 'calendar_events',
        ref_id: ev.id,
      });
    }
  }

  const tasks = await db.prepare(`
    SELECT t.*, c.razon_social as cliente_nombre FROM tasks t
    LEFT JOIN clients c ON c.id = t.client_id
    WHERE t.estado NOT IN ('Completada') AND t.fecha >= date('now', '-1 day') AND t.fecha <= date('now')
  `).all();

  for (const t of tasks) {
    if (await alreadyNotified('tasks', t.id)) continue;
    const dt = eventDateTime(t.fecha, t.hora);
    if (now >= dt) {
      const vencida = t.fecha < now.toISOString().slice(0, 10) ? ' (VENCIDA)' : '';
      await insertNotification({
        tipo: 'Tarea programada',
        mensaje: `${t.titulo}${vencida} — ${t.hora ? 'programada para ' + t.hora : 'programada para hoy'}${t.cliente_nombre ? ' · ' + t.cliente_nombre : ''}`,
        client_id: t.client_id,
        ref_table: 'tasks',
        ref_id: t.id,
      });
    }
  }
}

router.get('/due', async (req, res) => {
  await scanForDueReminders();
  const rows = await db.prepare(`SELECT * FROM notifications WHERE leida = 0 ORDER BY created_at DESC LIMIT 50`).all();
  res.json(rows);
});

router.get('/', async (req, res) => {
  res.json(await db.prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100`).all());
});

router.patch('/:id/read', async (req, res) => {
  await db.prepare('UPDATE notifications SET leida = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.patch('/read-all', async (req, res) => {
  await db.prepare('UPDATE notifications SET leida = 1 WHERE leida = 0').run();
  res.json({ ok: true });
});

export default router;
