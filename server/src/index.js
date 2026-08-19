import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { seed, clearBusinessData } from './seed.js';

import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import prospectsRoutes from './routes/prospects.js';
import pipelineRoutes from './routes/pipeline.js';
import productsRoutes from './routes/products.js';
import quotesRoutes from './routes/quotes.js';
import salesRoutes from './routes/sales.js';
import tasksRoutes from './routes/tasks.js';
import calendarRoutes from './routes/calendar.js';
import collectionsRoutes from './routes/collections.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';
import searchRoutes from './routes/search.js';
import importRoutes from './routes/importRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import notificationsRoutes from './routes/notifications.js';
import activitiesRoutes from './routes/activities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/prospects', prospectsRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Siembra inicial de datos de ejemplo en producción, protegida con una clave secreta
// (variable de entorno ADMIN_SEED_KEY). Se visita una sola vez desde el navegador:
// https://<tu-app>.onrender.com/api/admin/seed?key=<ADMIN_SEED_KEY>
// No hace nada si ya hay datos cargados (ver seed.js).
app.get('/api/admin/seed', async (req, res) => {
  if (!process.env.ADMIN_SEED_KEY || req.query.key !== process.env.ADMIN_SEED_KEY) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    await seed();
    res.json({ ok: true, message: 'Listo. Si no había datos, se cargaron los datos de ejemplo. Si ya había, no se tocó nada.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Borra los datos de ejemplo (clientes, ventas, cotizaciones, pipeline, tareas, etc.) para arrancar
// a cargar datos reales. NO borra usuarios ni configuración, así nadie pierde el acceso.
// Requiere la misma clave que /api/admin/seed, más una confirmación explícita en la URL.
// https://<tu-app>.onrender.com/api/admin/reset-data?key=<ADMIN_SEED_KEY>&confirm=BORRAR
app.get('/api/admin/reset-data', async (req, res) => {
  if (!process.env.ADMIN_SEED_KEY || req.query.key !== process.env.ADMIN_SEED_KEY) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (req.query.confirm !== 'BORRAR') {
    return res.status(400).json({
      error: 'Falta confirmación. Agregá &confirm=BORRAR al final de la URL para confirmar que querés borrar todos los clientes, ventas, cotizaciones, etc. (los usuarios y la configuración no se tocan).',
    });
  }
  try {
    await clearBusinessData();
    res.json({ ok: true, message: 'Datos de ejemplo eliminados. Los usuarios y la configuración se mantuvieron intactos. Ya podés empezar a cargar datos reales.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Servir frontend build en producción
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), err => { if (err) next(); });
});

const PORT = process.env.PORT || 4000;
await initDb();
app.listen(PORT, () => console.log(`CRM backend escuchando en http://localhost:${PORT}`));
