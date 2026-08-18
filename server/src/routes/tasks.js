import express from 'express';
import db from '../db.js';
import { logActivity } from '../helpers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { estado, responsable, client_id, fecha, fecha_desde, fecha_hasta } = req.query;
  let sql = `SELECT t.*, c.razon_social as cliente_nombre FROM tasks t LEFT JOIN clients c ON c.id = t.client_id WHERE 1=1`;
  const params = [];
  if (estado) { sql += ' AND t.estado = ?'; params.push(estado); }
  if (responsable) { sql += ' AND t.responsable = ?'; params.push(responsable); }
  if (client_id) { sql += ' AND t.client_id = ?'; params.push(client_id); }
  if (fecha) { sql += ' AND t.fecha = ?'; params.push(fecha); }
  if (fecha_desde) { sql += ' AND t.fecha >= ?'; params.push(fecha_desde); }
  if (fecha_hasta) { sql += ' AND t.fecha <= ?'; params.push(fecha_hasta); }
  sql += ' ORDER BY t.fecha ASC, t.hora ASC';
  res.json(await db.prepare(sql).all(...params));
});

router.post('/', async (req, res) => {
  const t = req.body;
  const id = (await db.prepare(`INSERT INTO tasks (titulo, client_id, fecha, hora, prioridad, responsable, descripcion, estado) VALUES (?,?,?,?,?,?,?,?)`)
    .run(t.titulo, t.client_id || null, t.fecha, t.hora, t.prioridad || 'Media', t.responsable, t.descripcion, t.estado || 'Pendiente')).lastInsertRowid;
  if (t.client_id) await logActivity(t.client_id, 'Tarea', `Tarea creada: ${t.titulo}`, t.usuario, 'tasks', id);
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const t = req.body;
  await db.prepare(`UPDATE tasks SET titulo=?, client_id=?, fecha=?, hora=?, prioridad=?, responsable=?, descripcion=?, estado=?, updated_at=datetime('now') WHERE id=?`)
    .run(t.titulo, t.client_id || null, t.fecha, t.hora, t.prioridad, t.responsable, t.descripcion, t.estado, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/complete', async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
  await db.prepare(`UPDATE tasks SET estado='Completada', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  if (task.client_id) await logActivity(task.client_id, 'Tarea', `Tarea completada: ${task.titulo}`, req.body.usuario, 'tasks', task.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
