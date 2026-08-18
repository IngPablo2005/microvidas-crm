import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

router.get('/users', requireAuth, requireRole('Administrador', 'Gerente'), async (req, res) => {
  res.json(await db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name').all());
});

router.post('/users', requireAuth, requireRole('Administrador'), async (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = bcrypt.hashSync(password || 'microvidas2026', 8);
  try {
    const id = (await db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run(name, email, hash, role || 'Vendedor')).lastInsertRowid;
    res.status(201).json({ id });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo crear el usuario (email duplicado?)' });
  }
});

router.put('/users/:id', requireAuth, requireRole('Administrador'), async (req, res) => {
  const { name, role, active, password } = req.body;
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (role !== undefined) { fields.push('role = ?'); params.push(role); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (password) { fields.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 8)); }
  fields.push("updated_at = datetime('now')");
  if (!fields.length) return res.json({ ok: true });
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  res.json({ ok: true });
});

export default router;
