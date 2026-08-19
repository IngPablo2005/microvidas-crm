import express from 'express';
import db from '../db.js';

const router = express.Router();

// Tipos de actividad que cuentan como "contacto real" con el cliente: al registrarlos
// se actualiza clients.ultimo_contacto (usado por la alerta "Cliente sin contacto").
const TIPOS_CONTACTO = ['Visita', 'Llamada'];

// Listado simple de actividades (pensado para el panel de "últimas visitas y llamadas"
// del Dashboard, pero admite cualquier tipo si se necesita en otro lado).
router.get('/', async (req, res) => {
  const { tipo, client_id, limit = 20 } = req.query;
  let sql = `SELECT a.id, a.tipo, a.descripcion, a.usuario, a.fecha, a.client_id, c.razon_social as cliente_nombre
             FROM activities a JOIN clients c ON c.id = a.client_id WHERE 1=1`;
  const params = [];
  if (tipo) {
    const tipos = String(tipo).split(',').map(t => t.trim()).filter(Boolean);
    sql += ` AND a.tipo IN (${tipos.map(() => '?').join(',')})`;
    params.push(...tipos);
  }
  if (client_id) { sql += ' AND a.client_id = ?'; params.push(client_id); }
  sql += ' ORDER BY a.fecha DESC LIMIT ?';
  params.push(Number(limit));
  res.json(await db.prepare(sql).all(...params));
});

// Registrar una actividad manual (pensado sobre todo para "Visita" y "Llamada" desde
// el Dashboard, sin tener que entrar a la ficha del cliente). También sirve para
// cualquier otro tipo si en el futuro se quiere reusar desde otro lado.
router.post('/', async (req, res) => {
  const { client_id, tipo, descripcion, usuario, fecha } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Falta seleccionar un cliente' });
  if (!tipo) return res.status(400).json({ error: 'Falta el tipo de actividad' });

  const cliente = await db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const fechaVal = fecha && fecha.length === 10 ? `${fecha} ${new Date().toTimeString().slice(0, 8)}` : (fecha || undefined);
  const id = fechaVal
    ? (await db.prepare('INSERT INTO activities (client_id, tipo, descripcion, usuario, fecha) VALUES (?,?,?,?,?)')
        .run(client_id, tipo, descripcion || '', usuario || 'Usuario', fechaVal)).lastInsertRowid
    : (await db.prepare('INSERT INTO activities (client_id, tipo, descripcion, usuario) VALUES (?,?,?,?)')
        .run(client_id, tipo, descripcion || '', usuario || 'Usuario')).lastInsertRowid;

  if (TIPOS_CONTACTO.includes(tipo)) {
    const soloFecha = (fecha && fecha.length >= 10) ? fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    await db.prepare(`UPDATE clients SET ultimo_contacto = ? WHERE id = ? AND (ultimo_contacto IS NULL OR ultimo_contacto < ?)`)
      .run(soloFecha, client_id, soloFecha);
  }

  res.status(201).json({ id });
});

export default router;
