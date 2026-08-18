import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import db from '../db.js';

const router = express.Router();
const importDir = path.join(process.cwd(), 'uploads', 'imports');
if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
const upload = multer({ dest: importDir, limits: { fileSize: 25 * 1024 * 1024 } });

const CRM_FIELDS = [
  { key: 'razon_social', label: 'Razón Social', required: true },
  { key: 'nombre_comercial', label: 'Nombre Comercial' },
  { key: 'cuit', label: 'CUIT' },
  { key: 'contacto_principal', label: 'Contacto Principal' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'localidad', label: 'Localidad' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'tipo_cliente', label: 'Tipo de Cliente' },
  { key: 'segmento', label: 'Segmento' },
  { key: 'potencial_comercial', label: 'Potencial Comercial' },
  { key: 'responsable_comercial', label: 'Responsable Comercial' },
  { key: 'observaciones', label: 'Observaciones' },
];

const SYNONYMS = {
  razon_social: ['razon social', 'razón social', 'empresa', 'cliente', 'nombre'],
  nombre_comercial: ['nombre comercial', 'fantasia', 'fantasía'],
  cuit: ['cuit', 'cuil', 'nif'],
  contacto_principal: ['contacto', 'contacto principal', 'referente'],
  cargo: ['cargo', 'puesto'],
  telefono: ['telefono', 'teléfono', 'tel', 'phone'],
  whatsapp: ['whatsapp', 'wsp', 'wa'],
  email: ['email', 'correo', 'mail', 'e-mail'],
  provincia: ['provincia', 'estado'],
  localidad: ['localidad', 'ciudad'],
  direccion: ['direccion', 'dirección', 'domicilio'],
  tipo_cliente: ['tipo de cliente', 'tipo'],
  segmento: ['segmento'],
  potencial_comercial: ['potencial', 'potencial comercial'],
  responsable_comercial: ['responsable', 'vendedor', 'responsable comercial'],
  observaciones: ['observaciones', 'notas', 'comentarios'],
};

function normalize(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function suggestMapping(headers) {
  const mapping = {};
  for (const h of headers) {
    const nh = normalize(h);
    let matchKey = null;
    for (const field of CRM_FIELDS) {
      if (normalize(field.label) === nh) { matchKey = field.key; break; }
      const syns = SYNONYMS[field.key] || [];
      if (syns.some(s => normalize(s) === nh)) { matchKey = field.key; break; }
    }
    mapping[h] = matchKey;
  }
  return mapping;
}

function readSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return rows;
}

router.post('/clients/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    const rows = readSheet(req.file.path);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const mapping = suggestMapping(headers);
    res.json({
      uploadId: req.file.filename,
      filename: req.file.originalname,
      headers,
      mapping,
      fields: CRM_FIELDS,
      total: rows.length,
      preview: rows.slice(0, 10),
    });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo leer el archivo: ' + e.message });
  }
});

router.post('/clients/confirm', express.json(), async (req, res) => {
  const { uploadId, mapping, mode = 'importNew', dedupeField = 'cuit' } = req.body;
  const filePath = path.join(importDir, uploadId);
  if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'El archivo cargado ya no está disponible, volvé a subirlo.' });

  let rows;
  try { rows = readSheet(filePath); } catch (e) { return res.status(400).json({ error: 'No se pudo leer el archivo: ' + e.message }); }

  const inverseMapping = {}; // crmField -> header
  for (const [header, crmField] of Object.entries(mapping)) if (crmField) inverseMapping[crmField] = header;

  let imported = 0, updated = 0, duplicates = 0;
  const errors = [];
  const insert = db.prepare(`INSERT INTO clients (razon_social, nombre_comercial, cuit, contacto_principal, cargo, telefono, whatsapp, email, provincia, localidad, direccion, tipo_cliente, segmento, potencial_comercial, responsable_comercial, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const updateStmt = db.prepare(`UPDATE clients SET nombre_comercial=?, contacto_principal=?, cargo=?, telefono=?, whatsapp=?, email=?, provincia=?, localidad=?, direccion=?, tipo_cliente=?, segmento=?, potencial_comercial=?, responsable_comercial=?, observaciones=?, updated_at=datetime('now') WHERE id=?`);

  for (const [idx, row] of rows.entries()) {
    const rec = {};
    for (const field of CRM_FIELDS) {
      const header = inverseMapping[field.key];
      rec[field.key] = header ? String(row[header] ?? '').trim() : '';
    }
    if (!rec.razon_social) {
      errors.push({ fila: idx + 2, error: 'Falta Razón Social', datos: row });
      continue;
    }
    let existing = null;
    if (dedupeField === 'cuit' && rec.cuit) existing = await db.prepare('SELECT id FROM clients WHERE cuit = ?').get(rec.cuit);
    else if (dedupeField === 'email' && rec.email) existing = await db.prepare('SELECT id FROM clients WHERE email = ?').get(rec.email);
    else existing = await db.prepare('SELECT id FROM clients WHERE razon_social = ?').get(rec.razon_social);

    if (existing) {
      duplicates++;
      if (mode === 'updateExisting') {
        await updateStmt.run(rec.nombre_comercial, rec.contacto_principal, rec.cargo, rec.telefono, rec.whatsapp, rec.email,
          rec.provincia, rec.localidad, rec.direccion, rec.tipo_cliente, rec.segmento, rec.potencial_comercial,
          rec.responsable_comercial, rec.observaciones, existing.id);
        updated++;
      }
      // si mode === 'importNew' o 'ignoreDuplicates', no se toca el existente
      continue;
    }
    try {
      await insert.run(rec.razon_social, rec.nombre_comercial, rec.cuit, rec.contacto_principal, rec.cargo, rec.telefono,
        rec.whatsapp, rec.email, rec.provincia, rec.localidad, rec.direccion, rec.tipo_cliente, rec.segmento,
        rec.potencial_comercial, rec.responsable_comercial, rec.observaciones);
      imported++;
    } catch (e) {
      errors.push({ fila: idx + 2, error: e.message, datos: row });
    }
  }

  let errorReportId = null;
  if (errors.length) {
    errorReportId = `errors-${Date.now()}.json`;
    fs.writeFileSync(path.join(importDir, errorReportId), JSON.stringify(errors, null, 2));
  }

  res.json({ total: rows.length, imported, updated, duplicates, errores: errors.length, errorReportId });
});

router.get('/errors/:id', (req, res) => {
  const filePath = path.join(importDir, req.params.id);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Reporte no encontrado' });
  const errors = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const headers = ['fila', 'error', ...Object.keys(errors[0]?.datos || {})];
  const csvLines = [headers.join(',')];
  for (const e of errors) {
    const line = [e.fila, `"${e.error.replace(/"/g, '""')}"`, ...Object.keys(errors[0]?.datos || {}).map(h => `"${String(e.datos[h] ?? '').replace(/"/g, '""')}"`)];
    csvLines.push(line.join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="errores_importacion.csv"`);
  res.send(csvLines.join('\n'));
});

export default router;
