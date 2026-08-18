import express from 'express';
import db from '../db.js';
import { logActivity } from '../helpers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { desde, hasta, client_id, tipo } = req.query;
  let sql = `SELECT e.*, c.razon_social as cliente_nombre FROM calendar_events e LEFT JOIN clients c ON c.id = e.client_id WHERE 1=1`;
  const params = [];
  if (desde) { sql += ' AND e.fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND e.fecha <= ?'; params.push(hasta); }
  if (client_id) { sql += ' AND e.client_id = ?'; params.push(client_id); }
  if (tipo) { sql += ' AND e.tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY e.fecha ASC, e.hora ASC';
  res.json(await db.prepare(sql).all(...params));
});

router.post('/', async (req, res) => {
  const e = req.body;
  const id = (await db.prepare(`INSERT INTO calendar_events (titulo, client_id, fecha, hora, tipo, descripcion, prioridad, recordatorio, repeticion, estado)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    e.titulo, e.client_id || null, e.fecha, e.hora, e.tipo || 'Reunion', e.descripcion, e.prioridad || 'Media',
    e.recordatorio || 'Ninguno', e.repeticion || 'Ninguna', e.estado || 'Pendiente'
  )).lastInsertRowid;
  // Crear tarea asociada automáticamente para que aparezca en "Tareas de hoy"
  await db.prepare(`INSERT INTO tasks (titulo, client_id, fecha, hora, prioridad, responsable, descripcion, estado) VALUES (?,?,?,?,?,?,?,?)`)
    .run(e.titulo, e.client_id || null, e.fecha, e.hora, e.prioridad || 'Media', e.responsable || '', `Evento de calendario (${e.tipo}). ${e.descripcion || ''}`, 'Pendiente');
  if (e.client_id) await logActivity(e.client_id, e.tipo || 'Otro', `Evento programado: ${e.titulo}`, e.usuario, 'calendar_events', id);
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const e = req.body;
  await db.prepare(`UPDATE calendar_events SET titulo=?, client_id=?, fecha=?, hora=?, tipo=?, descripcion=?, prioridad=?, recordatorio=?, repeticion=?, estado=? WHERE id=?`)
    .run(e.titulo, e.client_id || null, e.fecha, e.hora, e.tipo, e.descripcion, e.prioridad, e.recordatorio, e.repeticion, e.estado, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
