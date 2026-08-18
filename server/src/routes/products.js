import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM products WHERE activo = 1 ORDER BY nombre').all());
});

router.post('/', async (req, res) => {
  const { nombre, categoria, precio_unitario, moneda, unidad } = req.body;
  const id = (await db.prepare('INSERT INTO products (nombre, categoria, precio_unitario, moneda, unidad) VALUES (?,?,?,?,?)')
    .run(nombre, categoria, precio_unitario || 0, moneda || 'USD', unidad || 'unidad')).lastInsertRowid;
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const { nombre, categoria, precio_unitario, moneda, unidad, activo } = req.body;
  await db.prepare('UPDATE products SET nombre=?, categoria=?, precio_unitario=?, moneda=?, unidad=?, activo=? WHERE id=?')
    .run(nombre, categoria, precio_unitario, moneda, unidad, activo === undefined ? 1 : (activo ? 1 : 0), req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('UPDATE products SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
