import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import db from '../db.js';

const router = express.Router();

const pricelistDir = path.join(process.cwd(), 'uploads', 'pricelists');
if (!fs.existsSync(pricelistDir)) fs.mkdirSync(pricelistDir, { recursive: true });
const upload = multer({ dest: pricelistDir, limits: { fileSize: 15 * 1024 * 1024 } });

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
  const { nombre, categoria, precio_unitario, moneda, unidad, proveedor_id } = req.body;
  const id = (await db.prepare('INSERT INTO products (nombre, categoria, precio_unitario, moneda, unidad, proveedor_id) VALUES (?,?,?,?,?,?)')
    .run(nombre, categoria, precio_unitario || 0, moneda || 'USD', unidad || 'unidad', proveedor_id || null)).lastInsertRowid;
  res.status(201).json({ id });
});

router.put('/:id', async (req, res) => {
  const { nombre, categoria, precio_unitario, moneda, unidad, activo, proveedor_id } = req.body;
  await db.prepare('UPDATE products SET nombre=?, categoria=?, precio_unitario=?, moneda=?, unidad=?, activo=?, proveedor_id=? WHERE id=?')
    .run(nombre, categoria, precio_unitario, moneda, unidad, activo === undefined ? 1 : (activo ? 1 : 0), proveedor_id || null, req.params.id);
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

// ---------------------------------------------------------------------------
// Importar lista de precios en PDF con IA: sube el PDF, Claude interpreta el
// texto/tabla y devuelve proveedor + productos con precio de lista; en paralelo
// se intenta extraer del propio PDF una imagen candidata a logo del proveedor
// (heurística: primera imagen JPEG embebida de tamaño razonable). Todo queda en
// una vista previa editable — nada se guarda en el catálogo hasta /confirm.
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `Sos un asistente que lee listas de precios de proveedores agropecuarios en PDF.
Del documento adjunto, extraé:
1. El nombre del proveedor o la marca que emite la lista (si no figura ninguno, usá "Proveedor sin nombre").
2. La moneda predominante de los precios: "USD" o "ARS".
3. Cada producto/ítem de la lista, con: nombre, categoría (breve, si se puede inferir; si no, dejalo vacío) y precio_unitario (número, sin símbolo de moneda ni separadores de miles, usando punto decimal).

Ignorá encabezados, pies de página, condiciones comerciales o texto que no sea un ítem de precio. Si un mismo producto tiene varias presentaciones o tamaños con precios distintos, listalos como productos separados con nombres que los distingan.

Respondé ÚNICAMENTE con un JSON válido (sin bloques de código markdown, sin texto antes ni después), con exactamente esta forma:
{"proveedor": "...", "moneda": "USD", "productos": [{"nombre": "...", "categoria": "...", "precio_unitario": 0}]}`;

function extractJson(text) {
  const trimmed = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('La respuesta de la IA no contenía un JSON reconocible.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

// Heurística liviana y sin dependencias nativas (apta para el hosting free de
// Render): recorre los objetos del PDF buscando imágenes JPEG embebidas (el
// formato más común para un logo escaneado o pegado en un PDF) dentro de un
// rango de tamaño razonable para un isologo, y se queda con la más grande de
// ese rango. No reconstruye imágenes PNG/Flate crudas (más raras como logo);
// si no encuentra nada razonable, devuelve null y el usuario puede subir el
// logo a mano en la vista previa.
async function extractLikelyLogoDataUrl(pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
    let best = null;
    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      const subtype = dict.lookup(PDFName.of('Subtype'));
      if (!subtype || subtype.toString() !== '/Image') continue;

      const filterEntry = dict.lookup(PDFName.of('Filter'));
      const filters = [];
      if (filterEntry) {
        if (typeof filterEntry.asArray === 'function') filterEntry.asArray().forEach(f => filters.push(f.toString()));
        else filters.push(filterEntry.toString());
      }
      if (!filters.includes('/DCTDecode')) continue; // sólo JPEG embebido tal cual, sin recodificar

      const widthObj = dict.lookup(PDFName.of('Width'));
      const heightObj = dict.lookup(PDFName.of('Height'));
      const width = widthObj?.asNumber ? widthObj.asNumber() : 0;
      const height = heightObj?.asNumber ? heightObj.asNumber() : 0;
      if (width < 40 || height < 40 || width > 1600 || height > 1600) continue; // descarta íconos diminutos y fotos de página completa

      const area = width * height;
      if (!best || area > best.area) best = { bytes: obj.contents, area };
    }
    if (!best) return null;
    return `data:image/jpeg;base64,${Buffer.from(best.bytes).toString('base64')}`;
  } catch {
    return null;
  }
}

router.post('/import-pricelist/preview', upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return res.status(400).json({ error: 'Subí un archivo PDF.' });
    if (!process.env.ANTHROPIC_API_KEY) {
      cleanup();
      return res.status(400).json({ error: 'Falta configurar la clave de IA en el servidor (variable ANTHROPIC_API_KEY en Render → Environment). Pedile a Pablo que la agregue.' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const [aiResult, logoDataUrl] = await Promise.all([
      anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBytes.toString('base64') } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      }),
      extractLikelyLogoDataUrl(pdfBytes),
    ]);

    cleanup();

    const textBlock = aiResult.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('La IA no devolvió texto interpretable.');
    const parsed = extractJson(textBlock.text);
    const productos = Array.isArray(parsed.productos) ? parsed.productos : [];
    if (productos.length === 0) throw new Error('No se detectaron productos en el PDF. Probá con un archivo más claro o cargalos a mano.');

    res.json({
      proveedor: parsed.proveedor || 'Proveedor sin nombre',
      moneda: parsed.moneda === 'ARS' ? 'ARS' : 'USD',
      productos: productos.map(p => ({
        nombre: String(p.nombre || '').trim(),
        categoria: p.categoria ? String(p.categoria).trim() : '',
        precio_unitario: Number(p.precio_unitario) || 0,
      })).filter(p => p.nombre),
      logo_data_url: logoDataUrl,
    });
  } catch (err) {
    cleanup();
    console.error('Error importando lista de precios:', err);
    res.status(500).json({ error: err.message || 'No se pudo interpretar el PDF.' });
  }
});

router.post('/import-pricelist/confirm', async (req, res) => {
  const { proveedor, moneda, logo_data_url, productos } = req.body;
  if (!proveedor || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos para confirmar la importación.' });
  }

  let prov = await db.prepare('SELECT * FROM proveedores WHERE nombre = ?').get(proveedor);
  let provId;
  if (prov) {
    provId = prov.id;
    if (logo_data_url) await db.prepare('UPDATE proveedores SET logo_data_url = ? WHERE id = ?').run(logo_data_url, provId);
  } else {
    provId = (await db.prepare('INSERT INTO proveedores (nombre, logo_data_url) VALUES (?,?)').run(proveedor, logo_data_url || null)).lastInsertRowid;
  }

  const insProd = db.prepare('INSERT INTO products (nombre, categoria, precio_unitario, moneda, unidad, proveedor_id) VALUES (?,?,?,?,?,?)');
  let count = 0;
  for (const p of productos) {
    const nombre = String(p.nombre || '').trim();
    if (!nombre) continue;
    await insProd.run(nombre, p.categoria || null, Number(p.precio_unitario) || 0, moneda === 'ARS' ? 'ARS' : 'USD', 'unidad', provId);
    count++;
  }

  res.status(201).json({ ok: true, proveedor_id: provId, count });
});

export default router;
