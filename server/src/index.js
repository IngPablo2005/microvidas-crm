import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';

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
app.use('/api/reports', reportsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

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
