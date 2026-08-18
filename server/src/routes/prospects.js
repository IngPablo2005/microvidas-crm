import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { q, estado, responsable, provincia } = req.query;
  let sql = 'SELECT * FROM prospects WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (empresa LIKE ? OR contacto LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (estado) { sql += ' AND estado = ?'; params.push(estado); }
  if (responsable) { sql += ' AND responsable = ?'; params.push(responsable); }
  if (provincia) { sql += ' AND provincia = ?'; params.push(provincia); }
  sql += ' ORDER BY created_at DESC';
  res.json(await db.prepare(sql).all(...params));
});

router.get('/:id', async (req, res) => {
  const p = await db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });
  res.json(p);
});

router.post('/', async (req, res) => {
  const p = req.body;
  const id = (await db.prepare(`INSERT INTO prospects (empresa, contacto, telefono, email, localidad, provincia, origen, potencial_estimado, interes, responsable, proximo_contacto, probabilidad, estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    p.empresa, p.contacto, p.telefono, p.email, p.localidad, p.provincia, p.origen, p.potencial_estimado || 0,
    p.interes, p.responsable, p.proximo_contacto, p.probabilidad || 20, p.estado || 'Nuevo'
  )).lastInsertRowid;
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const p = req.body;
  await db.prepare(`UPDATE prospects SET empresa=?, contacto=?, telefono=?, email=?, localidad=?, provincia=?, origen=?, potencial_estimado=?,
    interes=?, responsable=?, proximo_contacto=?, probabilidad=?, estado=?, updated_at=datetime('now') WHERE id=?`).run(
    p.empresa, p.contacto, p.telefono, p.email, p.localidad, p.provincia, p.origen, p.potencial_estimado || 0,
    p.interes, p.responsable, p.proximo_contacto, p.probabilidad, p.estado, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM prospects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Convertir prospecto en cliente, conservando historial
router.post('/:id/convert', async (req, res) => {
  const p = await db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });
  const clientId = (await db.prepare(`INSERT INTO clients (razon_social, contacto_principal, telefono, email, provincia, localidad, tipo_cliente, estado, potencial_comercial, responsable_comercial, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    p.empresa, p.contacto, p.telefono, p.email, p.provincia, p.localidad, 'Convertido de prospecto', 'Activo',
    p.potencial_estimado > 20000 ? 'Alto' : p.potencial_estimado > 8000 ? 'Medio' : 'Bajo', p.responsable,
    `Convertido desde prospecto (origen: ${p.origen || 'N/D'}, interés: ${p.interes || 'N/D'}).`
  )).lastInsertRowid;
  await db.prepare('UPDATE prospects SET estado = ?, converted_client_id = ? WHERE id = ?').run('Ganado', clientId, req.params.id);
  await db.prepare(`INSERT INTO activities (client_id, tipo, descripcion, usuario) VALUES (?,?,?,?)`)
    .run(clientId, 'Cambio de estado', `Convertido desde prospecto "${p.empresa}".`, p.responsable);
  await db.prepare(`INSERT INTO milestones (client_id, tipo, descripcion, fecha) VALUES (?,?,?,date('now'))`)
    .run(clientId, 'Primer contacto', 'Conversión de prospecto a cliente.');
  // Reasignar oportunidades de pipeline
  await db.prepare('UPDATE pipeline_opportunities SET client_id = ?, prospect_id = NULL WHERE prospect_id = ?').run(clientId, req.params.id);
  res.status(201).json({ clientId });
});

export default router;
