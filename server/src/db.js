import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// En producción se configura TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (base de datos
// gestionada gratuita en Turso, persiste siempre aunque se redespliegue la app).
// Sin esas variables, cae a un archivo local (comportamiento igual al de antes,
// para desarrollo sin configurar nada extra).
const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', 'data', 'crm.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken, intMode: 'number' });

// Shim con la misma forma que usábamos con better-sqlite3 (db.prepare(sql).get/.all/.run),
// pero async porque ahora habla con una base remota. Todos los call-sites existentes
// (rutas, seed, helpers de reportes) se adaptaron para usar await.
function prepare(sql) {
  return {
    async get(...args) {
      const rs = await client.execute({ sql, args });
      return rs.rows[0];
    },
    async all(...args) {
      const rs = await client.execute({ sql, args });
      return rs.rows;
    },
    async run(...args) {
      const rs = await client.execute({ sql, args });
      return {
        lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : undefined,
        changes: rs.rowsAffected,
      };
    },
  };
}

async function exec(sql) {
  await client.executeMultiple(sql);
}

const db = { prepare, exec };

let readyPromise = null;

// Crea el esquema (si no existe) y aplica migraciones livianas. Debe esperarse
// (await initDb()) antes de levantar el servidor o de correr el seed.
export function initDb() {
  if (!readyPromise) readyPromise = migrate();
  return readyPromise;
}

async function migrate() {
  await exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Vendedor', -- Administrador, Gerente, Vendedor, Consulta
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  cuit TEXT,
  contacto_principal TEXT,
  cargo TEXT,
  telefono TEXT,
  whatsapp TEXT,
  email TEXT,
  provincia TEXT,
  localidad TEXT,
  direccion TEXT,
  tipo_cliente TEXT,
  segmento TEXT,
  estado TEXT DEFAULT 'Activo', -- Activo, Inactivo, Perdido
  potencial_comercial TEXT, -- Alto, Medio, Bajo
  fecha_alta TEXT DEFAULT (date('now')),
  ultimo_contacto TEXT,
  proximo_contacto TEXT,
  responsable_comercial TEXT,
  observaciones TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cargo TEXT,
  telefono TEXT,
  whatsapp TEXT,
  email TEXT,
  principal INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  localidad TEXT,
  provincia TEXT,
  origen TEXT,
  potencial_estimado REAL DEFAULT 0,
  interes TEXT,
  fecha_ingreso TEXT DEFAULT (date('now')),
  responsable TEXT,
  proximo_contacto TEXT,
  probabilidad INTEGER DEFAULT 20,
  estado TEXT DEFAULT 'Nuevo', -- Nuevo, Contactado, Calificado, Cotizacion, Negociacion, Ganado, Perdido
  converted_client_id INTEGER REFERENCES clients(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  categoria TEXT,
  precio_unitario REAL DEFAULT 0,
  moneda TEXT DEFAULT 'USD',
  unidad TEXT DEFAULT 'unidad',
  activo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pipeline_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  prospect_id INTEGER REFERENCES prospects(id),
  titulo TEXT,
  etapa TEXT DEFAULT 'Prospecto', -- Prospecto, Contactado, Reunion, Cotizacion, Negociacion, Ganada, Perdida
  importe_estimado REAL DEFAULT 0,
  probabilidad INTEGER DEFAULT 20,
  responsable TEXT,
  proxima_accion TEXT,
  fecha_cierre_estimada TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  fecha TEXT DEFAULT (date('now')),
  fecha_vencimiento TEXT,
  moneda TEXT DEFAULT 'USD',
  descuento_general REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  total REAL DEFAULT 0,
  probabilidad_cierre INTEGER DEFAULT 50,
  estado TEXT DEFAULT 'Borrador', -- Borrador, Enviada, En negociacion, Aceptada, Rechazada, Vencida
  responsable TEXT,
  observaciones TEXT,
  condiciones_comerciales TEXT, -- texto libre, precargado desde settings.condiciones_comerciales_default
  item_headers TEXT, -- JSON con los títulos de columna de la tabla de productos (editable por cotización)
  total_financiado REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  descripcion TEXT,
  cantidad REAL DEFAULT 1,
  precio_unitario REAL DEFAULT 0,
  descuento REAL DEFAULT 0,
  financiado REAL DEFAULT 0, -- precio financiado (USD) por unidad, editable manualmente por línea
  importe REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  quote_id INTEGER REFERENCES quotes(id),
  fecha TEXT DEFAULT (date('now')),
  moneda TEXT DEFAULT 'USD',
  total REAL DEFAULT 0,
  vendedor TEXT,
  observaciones TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  descripcion TEXT,
  cantidad REAL DEFAULT 1,
  precio_unitario REAL DEFAULT 0,
  importe REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  fecha TEXT DEFAULT (date('now')),
  hora TEXT,
  prioridad TEXT DEFAULT 'Media', -- Alta, Media, Baja
  responsable TEXT,
  descripcion TEXT,
  estado TEXT DEFAULT 'Pendiente', -- Pendiente, En proceso, Completada, Vencida
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  fecha TEXT NOT NULL,
  hora TEXT,
  tipo TEXT DEFAULT 'Reunion', -- Llamada, Reunion, Visita, WhatsApp, Email, Seguimiento, Cotizacion, Cobranza, Tarea, Otro
  descripcion TEXT,
  prioridad TEXT DEFAULT 'Media',
  recordatorio TEXT DEFAULT 'Ninguno',
  repeticion TEXT DEFAULT 'Ninguna',
  estado TEXT DEFAULT 'Pendiente',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- Llamada, Reunion, Visita, WhatsApp, Email, Cotizacion, Venta, Tarea, Nota, Cambio de estado, Archivo, Cobranza
  descripcion TEXT,
  usuario TEXT,
  fecha TEXT DEFAULT (datetime('now')),
  ref_table TEXT,
  ref_id INTEGER
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- Primer contacto, Primera reunion, Primera cotizacion, Primera venta, Venta importante, etc.
  descripcion TEXT,
  fecha TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nombre TEXT,
  tipo TEXT,
  filename TEXT,
  usuario TEXT,
  fecha TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  usuario TEXT,
  fecha TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  fecha TEXT DEFAULT (date('now')),
  comprobante TEXT,
  factura TEXT,
  importe REAL DEFAULT 0,
  moneda TEXT DEFAULT 'USD',
  medio_pago TEXT DEFAULT 'Transferencia bancaria',
  fecha_vencimiento_original TEXT,
  responsable TEXT,
  observaciones TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  sale_id INTEGER REFERENCES sales(id),
  numero TEXT,
  fecha TEXT DEFAULT (date('now')),
  fecha_vencimiento TEXT,
  importe REAL DEFAULT 0,
  moneda TEXT DEFAULT 'USD',
  saldo REAL DEFAULT 0,
  estado TEXT DEFAULT 'Pendiente' -- Pendiente, Pagada, Vencida
);

CREATE TABLE IF NOT EXISTS payment_commitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  importe_comprometido REAL DEFAULT 0,
  moneda TEXT DEFAULT 'USD',
  fecha_comprometida TEXT,
  invoice_id INTEGER REFERENCES invoices(id),
  responsable TEXT,
  observaciones TEXT,
  estado TEXT DEFAULT 'Pendiente', -- Pendiente, Cumplido, Incumplido
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT,
  mensaje TEXT,
  client_id INTEGER REFERENCES clients(id),
  leida INTEGER DEFAULT 0,
  ref_table TEXT,
  ref_id INTEGER,
  disparar_en TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  cultivo TEXT NOT NULL, -- Soja, Soja 2da, Trigo, Maíz, Girasol, Sorgo, Pasturas, Vicia, Arveja, Arroz, Otros
  hectareas REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(client_id, cultivo)
);

CREATE INDEX IF NOT EXISTS idx_activities_client ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_fecha ON tasks(fecha);
CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(fecha);
CREATE INDEX IF NOT EXISTS idx_collections_client ON collections(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_crops_client ON client_crops(client_id);
`);

  // Migraciones ligeras para bases ya existentes (creadas antes de agregar estas columnas)
  const notifCols = (await db.prepare("PRAGMA table_info(notifications)").all()).map(c => c.name);
  if (!notifCols.includes('ref_table')) await exec('ALTER TABLE notifications ADD COLUMN ref_table TEXT');
  if (!notifCols.includes('ref_id')) await exec('ALTER TABLE notifications ADD COLUMN ref_id INTEGER');
  if (!notifCols.includes('disparar_en')) await exec('ALTER TABLE notifications ADD COLUMN disparar_en TEXT');
  await exec('CREATE INDEX IF NOT EXISTS idx_notifications_ref ON notifications(ref_table, ref_id)');

  const quoteCols = (await db.prepare("PRAGMA table_info(quotes)").all()).map(c => c.name);
  if (!quoteCols.includes('condiciones_comerciales')) await exec('ALTER TABLE quotes ADD COLUMN condiciones_comerciales TEXT');
  if (!quoteCols.includes('item_headers')) await exec('ALTER TABLE quotes ADD COLUMN item_headers TEXT');
  if (!quoteCols.includes('total_financiado')) await exec('ALTER TABLE quotes ADD COLUMN total_financiado REAL DEFAULT 0');

  const quoteItemCols = (await db.prepare("PRAGMA table_info(quote_items)").all()).map(c => c.name);
  if (!quoteItemCols.includes('financiado')) await exec('ALTER TABLE quote_items ADD COLUMN financiado REAL DEFAULT 0');
}

export default db;
