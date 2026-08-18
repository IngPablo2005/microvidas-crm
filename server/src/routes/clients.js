import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';
import { logActivity } from '../helpers.js';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const { q, estado, provincia, localidad, responsable, segmento, potencial, page = 1, pageSize = 100 } = req.query;
  let sql = 'SELECT * FROM clients WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (razon_social LIKE ? OR nombre_comercial LIKE ? OR cuit LIKE ? OR contacto_principal LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (estado) { sql += ' AND estado = ?'; params.push(estado); }
  if (provincia) { sql += ' AND provincia = ?'; params.push(provincia); }
  if (localidad) { sql += ' AND localidad = ?'; params.push(localidad); }
  if (responsable) { sql += ' AND responsable_comercial = ?'; params.push(responsable); }
  if (segmento) { sql += ' AND segmento = ?'; params.push(segmento); }
  if (potencial) { sql += ' AND potencial_comercial = ?'; params.push(potencial); }
  sql += ' ORDER BY razon_social LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
  const rows = await db.prepare(sql).all(...params);
  const total = (await db.prepare('SELECT COUNT(*) c FROM clients').get()).c;
  res.json({ rows, total });
});

router.get('/:id', async (req, res) => {
  const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  const contacts = await db.prepare('SELECT * FROM contacts WHERE client_id = ? ORDER BY principal DESC, id').all(req.params.id);
  res.json({ ...client, contacts });
});

router.get('/:id/timeline', async (req, res) => {
  const acts = await db.prepare('SELECT id, tipo, descripcion, usuario, fecha, ref_table, ref_id FROM activities WHERE client_id = ?').all(req.params.id);
  const notes = (await db.prepare('SELECT id, texto as descripcion, usuario, fecha FROM notes WHERE client_id = ?').all(req.params.id)).map(n => ({ ...n, tipo: 'Nota' }));
  const milestones = (await db.prepare('SELECT id, tipo, descripcion, fecha FROM milestones WHERE client_id = ?').all(req.params.id)).map(m => ({ ...m, usuario: null }));
  const attachments = (await db.prepare('SELECT id, nombre as descripcion, usuario, fecha, tipo FROM attachments WHERE client_id = ?').all(req.params.id)).map(a => ({ ...a, tipo: 'Archivo: ' + (a.tipo || '') }));
  const timeline = [...acts, ...notes, ...milestones, ...attachments].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  res.json(timeline);
});

router.get('/:id/milestones', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM milestones WHERE client_id = ? ORDER BY fecha DESC').all(req.params.id));
});

router.post('/:id/milestones', async (req, res) => {
  const { tipo, descripcion, fecha, usuario } = req.body;
  const id = (await db.prepare('INSERT INTO milestones (client_id, tipo, descripcion, fecha) VALUES (?,?,?,?)').run(req.params.id, tipo, descripcion, fecha || new Date().toISOString().slice(0, 10))).lastInsertRowid;
  await logActivity(req.params.id, 'Hito', `${tipo}: ${descripcion || ''}`, usuario);
  res.status(201).json({ id });
});

router.post('/:id/notes', async (req, res) => {
  const { texto, usuario } = req.body;
  const id = (await db.prepare('INSERT INTO notes (client_id, texto, usuario) VALUES (?,?,?)').run(req.params.id, texto, usuario || 'Usuario')).lastInsertRowid;
  res.status(201).json({ id });
});

router.get('/:id/attachments', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM attachments WHERE client_id = ? ORDER BY fecha DESC').all(req.params.id));
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  const { usuario, tipo } = req.body;
  const id = (await db.prepare('INSERT INTO attachments (client_id, nombre, tipo, filename, usuario) VALUES (?,?,?,?,?)')
    .run(req.params.id, req.file.originalname, tipo || req.file.mimetype, req.file.filename, usuario || 'Usuario')).lastInsertRowid;
  await logActivity(req.params.id, 'Archivo', `Archivo subido: ${req.file.originalname}`, usuario);
  res.status(201).json({ id, filename: req.file.filename });
});

router.get('/:id/contacts', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM contacts WHERE client_id = ?').all(req.params.id));
});

router.post('/:id/contacts', async (req, res) => {
  const { nombre, cargo, telefono, whatsapp, email, principal } = req.body;
  const id = (await db.prepare('INSERT INTO contacts (client_id, nombre, cargo, telefono, whatsapp, email, principal) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id, nombre, cargo, telefono, whatsapp, email, principal ? 1 : 0)).lastInsertRowid;
  res.status(201).json({ id });
});

router.delete('/contacts/:contactId', async (req, res) => {
  await db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.contactId);
  res.json({ ok: true });
});

router.post('/', async (req, res) => {
  const c = req.body;
  const id = (await db.prepare(`INSERT INTO clients (razon_social, nombre_comercial, cuit, contacto_principal, cargo, telefono, whatsapp, email, provincia, localidad, direccion, tipo_cliente, segmento, estado, potencial_comercial, responsable_comercial, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    c.razon_social, c.nombre_comercial, c.cuit, c.contacto_principal, c.cargo, c.telefono, c.whatsapp, c.email,
    c.provincia, c.localidad, c.direccion, c.tipo_cliente, c.segmento, c.estado || 'Activo', c.potencial_comercial,
    c.responsable_comercial, c.observaciones
  )).lastInsertRowid;
  await logActivity(id, 'Cambio de estado', 'Cliente creado', c.usuario);
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const c = req.body;
  const prev = await db.prepare('SELECT estado FROM clients WHERE id = ?').get(req.params.id);
  await db.prepare(`UPDATE clients SET razon_social=?, nombre_comercial=?, cuit=?, contacto_principal=?, cargo=?, telefono=?, whatsapp=?, email=?,
    provincia=?, localidad=?, direccion=?, tipo_cliente=?, segmento=?, estado=?, potencial_comercial=?, ultimo_contacto=?, proximo_contacto=?,
    responsable_comercial=?, observaciones=?, updated_at=datetime('now') WHERE id=?`).run(
    c.razon_social, c.nombre_comercial, c.cuit, c.contacto_principal, c.cargo, c.telefono, c.whatsapp, c.email,
    c.provincia, c.localidad, c.direccion, c.tipo_cliente, c.segmento, c.estado, c.potencial_comercial,
    c.ultimo_contacto, c.proximo_contacto, c.responsable_comercial, c.observaciones, req.params.id
  );
  if (prev && c.estado && prev.estado !== c.estado) {
    await logActivity(req.params.id, 'Cambio de estado', `Estado cambiado de ${prev.estado} a ${c.estado}`, c.usuario);
  }
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
