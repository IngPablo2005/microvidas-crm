import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q.length) return res.json({ clients: [], prospects: [], contacts: [], quotes: [], sales: [], tasks: [], products: [] });
  const like = `%${q}%`;

  const clients = await db.prepare(`SELECT id, razon_social, nombre_comercial, cuit, estado FROM clients WHERE razon_social LIKE ? OR nombre_comercial LIKE ? OR cuit LIKE ? LIMIT 8`).all(like, like, like);
  const prospects = await db.prepare(`SELECT id, empresa, contacto, estado FROM prospects WHERE empresa LIKE ? OR contacto LIKE ? LIMIT 8`).all(like, like);
  const contacts = await db.prepare(`SELECT ct.id, ct.nombre, ct.client_id, c.razon_social FROM contacts ct JOIN clients c ON c.id = ct.client_id WHERE ct.nombre LIKE ? LIMIT 8`).all(like);
  const quotes = await db.prepare(`SELECT q.id, q.numero, q.total, c.razon_social FROM quotes q JOIN clients c ON c.id = q.client_id WHERE q.numero LIKE ? OR c.razon_social LIKE ? LIMIT 8`).all(like, like);
  const sales = await db.prepare(`SELECT s.id, s.numero, s.total, c.razon_social FROM sales s JOIN clients c ON c.id = s.client_id WHERE s.numero LIKE ? OR c.razon_social LIKE ? LIMIT 8`).all(like, like);
  const tasks = await db.prepare(`SELECT id, titulo, fecha, estado FROM tasks WHERE titulo LIKE ? LIMIT 8`).all(like);
  const products = await db.prepare(`SELECT id, nombre, precio_unitario FROM products WHERE nombre LIKE ? LIMIT 8`).all(like);

  res.json({ clients, prospects, contacts, quotes, sales, tasks, products });
});

export default router;
