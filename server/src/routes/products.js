import express from 'express';
import db from '../db.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Catálogo de productos
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  const { all } = req.query;
  const sql = `SELECT p.*, pr.nombre as proveedor_nombre, pr.logo_data_url as proveedor_logo
    FROM products p LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
    WHERE ${all ? '1=1' : 'p.activo = 1'} ORDER BY pr.nombre IS NULL, pr.nombre, p.nombre`;
  res.json(await db.prepare(sql).all());
});

router.post('/', async (req, res) => {
  const { nombre, categoria, precio_unitario, moneda, unidad, proveedor_id, logo_data_url } = req.body;
  const id = (await db.prepare('INSERT INTO products (nombre, categoria, precio_unitario, moneda, unidad, proveedor_id, logo_data_url) VALUES (?,?,?,?,?,?,?)')
    .run(nombre, categoria, precio_unitario || 0, moneda || 'USD', unidad || 'unidad', proveedor_id || null, logo_data_url || null)).lastInsertRowid;
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const prod = await db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
  const { nombre, categoria, precio_unitario, moneda, unidad, activo, proveedor_id, logo_data_url } = req.body;
  await db.prepare('UPDATE products SET nombre=?, categoria=?, precio_unitario=?, moneda=?, unidad=?, activo=?, proveedor_id=?, logo_data_url=? WHERE id=?')
    .run(nombre, categoria, precio_unitario, moneda, unidad, activo === undefined ? 1 : (activo ? 1 : 0), proveedor_id || null,
      logo_data_url === undefined ? prod.logo_data_url : logo_data_url, req.params.id);
  res.json({ ok: true });
});

// Desactiva el producto (soft delete, igual que el resto del CRM) para no romper
// cotizaciones/ventas ya emitidas que lo referencian.
router.delete('/:id', async (req, res) => {
  await db.prepare('UPDATE products SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Proveedores (marca/origen de una lista de precios importada)
// ---------------------------------------------------------------------------

router.get('/proveedores/list', async (req, res) => {
  res.json(await db.prepare(`SELECT pr.*, (SELECT COUNT(*) FROM products p WHERE p.proveedor_id = pr.id AND p.activo = 1) as productos_activos
    FROM proveedores pr ORDER BY pr.nombre`).all());
});

router.put('/proveedores/:id', async (req, res) => {
  const { nombre, logo_data_url } = req.body;
  const prov = await db.prepare('SELECT * FROM proveedores WHERE id = ?').get(req.params.id);
  if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });
  await db.prepare('UPDATE proveedores SET nombre=?, logo_data_url=? WHERE id=?')
    .run(nombre ?? prov.nombre, logo_data_url === undefined ? prov.logo_data_url : logo_data_url, req.params.id);
  res.json({ ok: true });
});

router.delete('/proveedores/:id', async (req, res) => {
  const activos = await db.prepare('SELECT COUNT(*) c FROM products WHERE proveedor_id = ? AND activo = 1').get(req.params.id);
  if (activos.c > 0) return res.status(400).json({ error: `Este proveedor tiene ${activos.c} producto(s) activo(s) en el catálogo. Desactivalos o reasignalos antes de borrar el proveedor.` });
  await db.prepare('DELETE FROM proveedores WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
