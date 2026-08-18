import express from 'express';
import db from '../db.js';

const router = express.Router();
const STAGES = ['Prospecto', 'Contactado', 'Reunion', 'Cotizacion', 'Negociacion', 'Ganada', 'Perdida'];

router.get('/', async (req, res) => {
  const rows = await db.prepare(`
    SELECT po.*, c.razon_social as cliente_nombre, p.empresa as prospecto_nombre
    FROM pipeline_opportunities po
    LEFT JOIN clients c ON c.id = po.client_id
    LEFT JOIN prospects p ON p.id = po.prospect_id
    ORDER BY po.updated_at DESC
  `).all();
  res.json({ stages: STAGES, rows });
});

router.post('/', async (req, res) => {
  const o = req.body;
  const id = (await db.prepare(`INSERT INTO pipeline_opportunities (client_id, prospect_id, titulo, etapa, importe_estimado, probabilidad, responsable, proxima_accion, fecha_cierre_estimada)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    o.client_id || null, o.prospect_id || null, o.titulo, o.etapa || 'Prospecto', o.importe_estimado || 0,
    o.probabilidad || 20, o.responsable, o.proxima_accion, o.fecha_cierre_estimada
  )).lastInsertRowid;
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const o = req.body;
  await db.prepare(`UPDATE pipeline_opportunities SET titulo=?, etapa=?, importe_estimado=?, probabilidad=?, responsable=?, proxima_accion=?, fecha_cierre_estimada=?, updated_at=datetime('now') WHERE id=?`)
    .run(o.titulo, o.etapa, o.importe_estimado, o.probabilidad, o.responsable, o.proxima_accion, o.fecha_cierre_estimada, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/stage', async (req, res) => {
  const { etapa } = req.body;
  if (!STAGES.includes(etapa)) return res.status(400).json({ error: 'Etapa inválida' });
  await db.prepare(`UPDATE pipeline_opportunities SET etapa=?, updated_at=datetime('now') WHERE id=?`).run(etapa, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM pipeline_opportunities WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
