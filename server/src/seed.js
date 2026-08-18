import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import db, { initDb } from './db.js';

const today = dayjs('2026-08-18');
const d = (offset, fmt = 'YYYY-MM-DD') => today.add(offset, 'day').format(fmt);

async function clearAll() {
  const tables = ['notifications','settings','payment_commitments','invoices','collections','notes','attachments',
    'milestones','activities','calendar_events','tasks','sale_items','sales','quote_items','quotes',
    'pipeline_opportunities','products','prospects','contacts','clients','users'];
  for (const t of tables) await db.exec(`DELETE FROM ${t}`);
}

// Borra únicamente los datos comerciales de ejemplo (clientes, prospectos, ventas, cotizaciones,
// pipeline, tareas, calendario, cobranzas, productos, etc.), sin tocar los usuarios ni la configuración
// (settings), para no dejar a nadie sin acceso al sistema. Pensado para usarse una sola vez antes de
// empezar a cargar datos reales.
async function clearBusinessData() {
  const tables = ['notifications','payment_commitments','invoices','collections','notes','attachments',
    'milestones','activities','calendar_events','tasks','sale_items','sales','quote_items','quotes',
    'pipeline_opportunities','products','prospects','contacts','clients'];
  for (const t of tables) await db.exec(`DELETE FROM ${t}`);
}

async function seed() {
  const existing = await db.prepare('SELECT COUNT(*) c FROM clients').get();
  if (existing.c > 0) {
    console.log('DB ya tiene datos, no se vuelve a sembrar. Usa --force para reiniciar.');
    return;
  }
  await run();
}

async function run() {
  // Users
  const users = [
    { name: 'Pablo Solier', email: 'psolier@microvidas.com.ar', role: 'Administrador' },
    { name: 'Lucía Fernández', email: 'lucia.fernandez@microvidas.com.ar', role: 'Gerente' },
    { name: 'Martín Gómez', email: 'martin.gomez@microvidas.com.ar', role: 'Vendedor' },
    { name: 'Sofía Ramírez', email: 'sofia.ramirez@microvidas.com.ar', role: 'Vendedor' },
    { name: 'Consulta Directorio', email: 'consulta@microvidas.com.ar', role: 'Consulta' },
  ];
  await db.prepare(`INSERT INTO settings (key, value) VALUES ('objetivo_mensual_usd', '60000')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run();
  await db.prepare(`INSERT INTO settings (key, value) VALUES ('dias_sin_contacto_alerta', '30')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run();

  const passHash = bcrypt.hashSync('microvidas2026', 8);
  const insUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)');
  for (const u of users) await insUser.run(u.name, u.email, passHash, u.role);

  // Products (bioinsumos agro)
  const products = [
    ['MicroFol Foliar 20L', 'Fertilizante foliar', 185, 'USD', 'bidón 20L'],
    ['BioFix Inoculante Soja', 'Inoculante', 42, 'USD', 'dosis 100ha'],
    ['NutriRaiz Bioestimulante', 'Bioestimulante', 96, 'USD', 'bidón 10L'],
    ['ActivPhos Solubilizador', 'Solubilizador de fósforo', 120, 'USD', 'bidón 20L'],
    ['DefendBio Control Biológico', 'Biocontrol', 210, 'USD', 'bidón 5L'],
    ['HumiCarbono Enmienda', 'Enmienda orgánica', 65, 'USD', 'bolsón 25kg'],
    ['Kit Análisis de Suelo', 'Servicio', 150, 'USD', 'servicio'],
  ];
  const insProd = db.prepare('INSERT INTO products (nombre, categoria, precio_unitario, moneda, unidad) VALUES (?,?,?,?,?)');
  const productIds = [];
  for (const p of products) productIds.push((await insProd.run(...p)).lastInsertRowid);

  // Clients
  const clients = [
    ['Agropecuaria Pérez S.A.', 'Agropecuaria Pérez', '30-71234567-8', 'Juan Pérez', 'Gerente General', '+54 9 11 4555-1234', '+54 9 11 4555-1234', 'juan.perez@agroperez.com.ar', 'Buenos Aires', 'Pergamino', 'Ruta 8 km 210', 'Productor', 'Cereales y oleaginosas', 'Activo', 'Alto', d(-420), d(-3), d(2), 'Martín Gómez', 'Cliente histórico. Interesado en ampliar uso de fertilización foliar en soja.'],
    ['Estancia La Rinconada SRL', 'La Rinconada', '30-70123456-1', 'María Sosa', 'Administradora', '+54 9 341 555-2210', '+54 9 341 555-2210', 'maria.sosa@larinconada.com.ar', 'Santa Fe', 'Rafaela', 'CR 13 s/n', 'Productor', 'Ganadería y agricultura', 'Activo', 'Alto', d(-380), d(-10), d(5), 'Martín Gómez', 'Renovación anual de inoculantes.'],
    ['AgroNorte Insumos S.A.', 'AgroNorte', '30-69876543-2', 'Roberto Díaz', 'Comprador', '+54 9 381 444-7788', '+54 9 381 444-7788', 'compras@agronorte.com.ar', 'Tucumán', 'San Miguel de Tucumán', 'Av. Aconquija 1200', 'Distribuidor', 'Distribución de insumos', 'Activo', 'Alto', d(-500), d(-1), d(1), 'Sofía Ramírez', 'Distribuidor clave en NOA. Pedidos mensuales.'],
    ['Campos del Sur SA', 'Campos del Sur', '30-68123987-4', 'Elena Torres', 'Ingeniera Agrónoma', '+54 9 291 455-3321', '+54 9 291 455-3321', 'etorres@camposdelsur.com.ar', 'Buenos Aires', 'Tres Arroyos', 'Acceso Sur km 4', 'Productor', 'Cereales', 'Activo', 'Medio', d(-200), d(-20), d(10), 'Martín Gómez', 'Probando NutriRaiz en lote piloto.'],
    ['Cooperativa Agrícola El Trigal', 'El Trigal', '30-67456123-9', 'Pedro Alarcón', 'Presidente', '+54 9 358 460-1122', '+54 9 358 460-1122', 'padministracion@eltrigal.coop', 'Córdoba', 'Marcos Juárez', 'Bv. Mitre 450', 'Cooperativa', 'Compra colectiva', 'Activo', 'Alto', d(-600), d(-45), d(-5), 'Sofía Ramírez', 'Cliente con deuda vencida a seguir de cerca.'],
    ['Bioagro del Litoral SRL', 'Bioagro Litoral', '30-66789456-3', 'Carla Núñez', 'Encargada de Compras', '+54 9 342 511-9090', '+54 9 342 511-9090', 'carla.nunez@bioagrolitoral.com.ar', 'Santa Fe', 'Reconquista', 'Ruta 11 km 780', 'Distribuidor', 'Distribución regional', 'Activo', 'Medio', d(-150), d(-7), d(15), 'Martín Gómez', ''],
    ['Estudio Agropecuario Fenoglio', 'Fenoglio', '30-65321789-5', 'Diego Fenoglio', 'Asesor Técnico', '+54 9 351 620-4455', '+54 9 351 620-4455', 'diego@fenoglioagro.com.ar', 'Córdoba', 'Río Cuarto', 'San Martín 780', 'Asesoría técnica', 'Asesores', 'Activo', 'Medio', d(-90), d(-14), d(3), 'Sofía Ramírez', 'Recomienda productos a 12 productores.'],
    ['Don Alberto Agropecuaria', 'Don Alberto', '30-64123654-7', 'Alberto Ruiz', 'Titular', '+54 9 2954 44-5566', '+54 9 2954 44-5566', 'alberto.ruiz@donalberto.com.ar', 'La Pampa', 'General Pico', 'Ruta 5 km 12', 'Productor', 'Mixto', 'Inactivo', 'Bajo', d(-700), d(-120), null, 'Martín Gómez', 'Sin actividad reciente, evaluar recontacto.'],
    ['Agroindustrias del Valle SA', 'Del Valle', '30-63456987-1', 'Natalia Vera', 'Jefa de Compras', '+54 9 261 433-8899', '+54 9 261 433-8899', 'nvera@agrovalle.com.ar', 'Mendoza', 'San Rafael', 'Parque Industrial Lote 8', 'Industria', 'Agroindustria', 'Activo', 'Alto', d(-250), d(-2), d(6), 'Sofía Ramírez', 'Volumen creciente año a año.'],
    ['Chacra Los Aromos', 'Los Aromos', '30-62789123-6', 'Fernando Lucero', 'Productor', '+54 9 3382 44-2200', '+54 9 3382 44-2200', 'flucero@losaromos.com.ar', 'Entre Ríos', 'Gualeguaychú', 'CR 6 s/n', 'Productor', 'Cereales', 'Activo', 'Medio', d(-60), d(-30), d(20), 'Martín Gómez', ''],
  ];
  const insClient = db.prepare(`INSERT INTO clients (razon_social, nombre_comercial, cuit, contacto_principal, cargo, telefono, whatsapp, email, provincia, localidad, direccion, tipo_cliente, segmento, estado, potencial_comercial, fecha_alta, ultimo_contacto, proximo_contacto, responsable_comercial, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const clientIds = [];
  for (const c of clients) clientIds.push((await insClient.run(...c)).lastInsertRowid);

  const insContact = db.prepare('INSERT INTO contacts (client_id, nombre, cargo, telefono, email, principal) VALUES (?,?,?,?,?,?)');
  for (let i = 0; i < clientIds.length; i++) {
    const cid = clientIds[i];
    await insContact.run(cid, clients[i][3], clients[i][4], clients[i][5], clients[i][7], 1);
  }
  await insContact.run(clientIds[0], 'Ana Pérez', 'Compras', '+54 9 11 4555-9988', 'ana.perez@agroperez.com.ar', 0);
  await insContact.run(clientIds[2], 'Laura Gímenez', 'Logística', '+54 9 381 444-1010', 'logistica@agronorte.com.ar', 0);

  // Milestones
  const insMile = db.prepare('INSERT INTO milestones (client_id, tipo, descripcion, fecha) VALUES (?,?,?,?)');
  await insMile.run(clientIds[0], 'Primer contacto', 'Contacto inicial en exposición AgroActiva.', d(-420));
  await insMile.run(clientIds[0], 'Primera venta', 'Primera compra de MicroFol Foliar.', d(-380));
  await insMile.run(clientIds[0], 'Venta importante', 'Compra de gran volumen para campaña de soja.', d(-60));
  await insMile.run(clientIds[4], 'Cliente con deuda', 'Factura vencida sin pago hace más de 30 días.', d(-32));
  await insMile.run(clientIds[7], 'Cliente perdido', 'Sin renovación de compra en el último año.', d(-120));
  await insMile.run(clientIds[8], 'Incorporación de nuevo producto', 'Comenzó a comprar DefendBio Control Biológico.', d(-40));

  // Notes
  const insNote = db.prepare('INSERT INTO notes (client_id, texto, usuario, fecha) VALUES (?,?,?,?)');
  await insNote.run(clientIds[0], 'Reunión con Juan Pérez. Interesado en aumentar el uso de fertilización foliar. Solicita cotización.', 'Martín Gómez', d(-3, 'YYYY-MM-DD HH:mm'));
  await insNote.run(clientIds[4], 'Llamada de seguimiento por factura vencida. Comprometen pago la semana próxima.', 'Sofía Ramírez', d(-5, 'YYYY-MM-DD HH:mm'));

  // Activities (auto + manual)
  const insAct = db.prepare('INSERT INTO activities (client_id, tipo, descripcion, usuario, fecha) VALUES (?,?,?,?,?)');
  const actSeed = [
    [0, 'Reunion', 'Reunión con Juan Pérez sobre fertilización foliar.', 'Martín Gómez', -3],
    [0, 'Cotizacion', 'Cotización enviada por MicroFol Foliar.', 'Martín Gómez', -2],
    [1, 'Llamada', 'Llamada de renovación de inoculantes.', 'Martín Gómez', -10],
    [2, 'WhatsApp', 'Confirmación de pedido mensual.', 'Sofía Ramírez', -1],
    [4, 'Cobranza', 'Gestión de cobranza por factura vencida.', 'Sofía Ramírez', -5],
    [8, 'Venta', 'Venta de DefendBio Control Biológico.', 'Sofía Ramírez', -40],
  ];
  for (const a of actSeed) await insAct.run(clientIds[a[0]], a[1], a[2], a[3], d(a[4], 'YYYY-MM-DD HH:mm'));

  // Prospects
  const prospects = [
    ['AgroFuturo Producciones', 'Ricardo Molina', '+54 9 358 400-1122', 'rmolina@agrofuturo.com.ar', 'Bell Ville', 'Córdoba', 'Feria AgroActiva', 25000, 'Bioestimulantes para maíz', d(-20), 'Martín Gómez', d(3), 40, 'Calificado'],
    ['Establecimiento Santa Clara', 'Julieta Paz', '+54 9 249 455-3344', 'jpaz@santaclara.com.ar', 'Bragado', 'Buenos Aires', 'Referido cliente', 12000, 'Inoculantes soja', d(-8), 'Sofía Ramírez', d(1), 25, 'Contactado'],
    ['Grupo Agropecuario Aráoz', 'Sebastián Aráoz', '+54 9 381 455-6677', 'saraoz@grupoaraoz.com.ar', 'Concepción', 'Tucumán', 'Web', 40000, 'Control biológico de plagas', d(-15), 'Martín Gómez', d(-1), 55, 'Cotizacion'],
    ['Chacra Verde Esperanza', 'Marcos Ledesma', '+54 9 3401 44-8899', 'mledesma@verdeesperanza.com.ar', 'Esperanza', 'Santa Fe', 'LinkedIn', 8000, 'Análisis de suelo', d(-4), 'Sofía Ramírez', d(6), 15, 'Nuevo'],
    ['Agroservicios del Norte', 'Paula Ibarra', '+54 9 387 411-2233', 'pibarra@agronortesa.com.ar', 'Salta', 'Salta', 'Feria AgroActiva', 30000, 'Enmiendas orgánicas', d(-30), 'Martín Gómez', d(-3), 65, 'Negociacion'],
  ];
  const insProsp = db.prepare(`INSERT INTO prospects (empresa, contacto, telefono, email, localidad, provincia, origen, potencial_estimado, interes, fecha_ingreso, responsable, proximo_contacto, probabilidad, estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const prospectIds = [];
  for (const p of prospects) prospectIds.push((await insProsp.run(...p)).lastInsertRowid);

  // Pipeline opportunities (linked to clients and prospects)
  const insPipe = db.prepare(`INSERT INTO pipeline_opportunities (client_id, prospect_id, titulo, etapa, importe_estimado, probabilidad, responsable, proxima_accion, fecha_cierre_estimada)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  await insPipe.run(clientIds[0], null, 'Ampliación fertilización foliar - soja', 'Cotizacion', 18500, 60, 'Martín Gómez', 'Enviar propuesta final', d(10));
  await insPipe.run(clientIds[3], null, 'Prueba NutriRaiz lote piloto', 'Reunion', 9000, 40, 'Martín Gómez', 'Coordinar visita a campo', d(15));
  await insPipe.run(clientIds[8], null, 'Ampliación línea DefendBio', 'Negociacion', 27000, 70, 'Sofía Ramírez', 'Definir condiciones de pago', d(7));
  await insPipe.run(null, prospectIds[0], 'AgroFuturo - Bioestimulantes maíz', 'Cotizacion', 25000, 40, 'Martín Gómez', 'Enviar cotización', d(12));
  await insPipe.run(null, prospectIds[2], 'Aráoz - Control biológico', 'Cotizacion', 40000, 55, 'Martín Gómez', 'Seguimiento telefónico', d(5));
  await insPipe.run(null, prospectIds[4], 'Agroservicios del Norte - Enmiendas', 'Negociacion', 30000, 65, 'Martín Gómez', 'Cerrar condiciones comerciales', d(4));
  await insPipe.run(clientIds[1], null, 'Renovación anual inoculantes', 'Prospecto', 15000, 20, 'Martín Gómez', 'Contactar en septiembre', d(25));
  await insPipe.run(clientIds[6], null, 'Recomendación Fenoglio a productores', 'Contactado', 22000, 30, 'Sofía Ramírez', 'Reunión técnica', d(18));

  // Quotes + items
  const insQuote = db.prepare(`INSERT INTO quotes (numero, client_id, fecha, fecha_vencimiento, moneda, descuento_general, subtotal, total, probabilidad_cierre, estado, responsable, observaciones)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insQItem = db.prepare(`INSERT INTO quote_items (quote_id, product_id, descripcion, cantidad, precio_unitario, descuento, importe) VALUES (?,?,?,?,?,?,?)`);

  async function createQuote(numero, clientIdx, fechaOff, vencOff, items, estado, prob, responsable, obs) {
    let subtotal = 0;
    const computed = items.map(it => {
      const importe = it.cantidad * it.precio * (1 - it.desc / 100);
      subtotal += importe;
      return { ...it, importe };
    });
    const total = subtotal; // descuento_general = 0 por defecto en este seed
    const qid = (await insQuote.run(numero, clientIds[clientIdx], d(fechaOff), d(vencOff), 'USD', 0, subtotal, total, prob, estado, responsable, obs)).lastInsertRowid;
    for (const it of computed) {
      await insQItem.run(qid, productIds[it.prodIdx], it.desc_text, it.cantidad, it.precio, it.desc, it.importe);
    }
    return qid;
  }

  await createQuote('COT-2026-0031', 0, -2, 10, [
    { prodIdx: 0, desc_text: 'MicroFol Foliar 20L', cantidad: 100, precio: 185, desc: 5 },
  ], 'Enviada', 60, 'Martín Gómez', 'Ampliación fertilización foliar soja.');

  await createQuote('COT-2026-0032', 3, -6, 3, [
    { prodIdx: 2, desc_text: 'NutriRaiz Bioestimulante', cantidad: 40, precio: 96, desc: 0 },
    { prodIdx: 6, desc_text: 'Kit Análisis de Suelo', cantidad: 3, precio: 150, desc: 0 },
  ], 'En negociacion', 40, 'Martín Gómez', 'Lote piloto Campos del Sur.');

  await createQuote('COT-2026-0033', 8, -1, 7, [
    { prodIdx: 4, desc_text: 'DefendBio Control Biológico', cantidad: 90, precio: 210, desc: 8 },
  ], 'En negociacion', 70, 'Sofía Ramírez', 'Ampliación línea biocontrol.');

  await createQuote('COT-2026-0034', 2, -15, -5, [
    { prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 300, precio: 42, desc: 3 },
  ], 'Vencida', 30, 'Sofía Ramírez', 'Pedido mensual, sin respuesta.');

  await createQuote('COT-2026-0035', 5, -25, -10, [
    { prodIdx: 5, desc_text: 'HumiCarbono Enmienda', cantidad: 150, precio: 65, desc: 5 },
  ], 'Rechazada', 20, 'Martín Gómez', 'Cliente eligió otro proveedor por precio.');

  await createQuote('COT-2026-0036', 9, -4, 12, [
    { prodIdx: 0, desc_text: 'MicroFol Foliar 20L', cantidad: 30, precio: 185, desc: 0 },
  ], 'Borrador', 25, 'Martín Gómez', 'Primera propuesta a Chacra Los Aromos.');

  // Sales + items (últimos 12 meses aprox, con concentración reciente)
  const insSale = db.prepare(`INSERT INTO sales (numero, client_id, quote_id, fecha, moneda, total, vendedor, observaciones) VALUES (?,?,?,?,?,?,?,?)`);
  const insSItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, descripcion, cantidad, precio_unitario, importe) VALUES (?,?,?,?,?,?)`);

  async function createSale(numero, clientIdx, fechaOff, vendedor, items, obs) {
    let total = 0;
    const computed = items.map(it => {
      const importe = it.cantidad * it.precio;
      total += importe;
      return { ...it, importe };
    });
    const sid = (await insSale.run(numero, clientIds[clientIdx], null, d(fechaOff), 'USD', total, vendedor, obs || '')).lastInsertRowid;
    for (const it of computed) await insSItem.run(sid, productIds[it.prodIdx], it.desc_text, it.cantidad, it.precio, it.importe);
    return { sid, total };
  }

  const salesSeed = [
    ['VTA-2026-0101', 0, 0, 'Martín Gómez', [{ prodIdx: 0, desc_text: 'MicroFol Foliar 20L', cantidad: 20, precio: 185 }]],
    ['VTA-2026-0102', 2, 0, 'Sofía Ramírez', [{ prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 150, precio: 42 }]],
    ['VTA-2026-0103', 8, -1, 'Sofía Ramírez', [{ prodIdx: 4, desc_text: 'DefendBio Control Biológico', cantidad: 40, precio: 210 }]],
    ['VTA-2026-0104', 1, -2, 'Martín Gómez', [{ prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 80, precio: 42 }]],
    ['VTA-2026-0105', 3, -6, 'Martín Gómez', [{ prodIdx: 2, desc_text: 'NutriRaiz Bioestimulante', cantidad: 20, precio: 96 }]],
    ['VTA-2026-0106', 5, -9, 'Martín Gómez', [{ prodIdx: 5, desc_text: 'HumiCarbono Enmienda', cantidad: 60, precio: 65 }]],
    ['VTA-2026-0107', 9, -13, 'Martín Gómez', [{ prodIdx: 0, desc_text: 'MicroFol Foliar 20L', cantidad: 15, precio: 185 }]],
    ['VTA-2026-0108', 2, -20, 'Sofía Ramírez', [{ prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 200, precio: 42 }]],
    ['VTA-2026-0109', 4, -28, 'Sofía Ramírez', [{ prodIdx: 3, desc_text: 'ActivPhos Solubilizador', cantidad: 50, precio: 120 }]],
    ['VTA-2026-0110', 0, -35, 'Martín Gómez', [{ prodIdx: 0, desc_text: 'MicroFol Foliar 20L', cantidad: 60, precio: 185 }]],
    ['VTA-2026-0111', 8, -45, 'Sofía Ramírez', [{ prodIdx: 4, desc_text: 'DefendBio Control Biológico', cantidad: 30, precio: 210 }]],
    ['VTA-2026-0112', 6, -55, 'Sofía Ramírez', [{ prodIdx: 2, desc_text: 'NutriRaiz Bioestimulante', cantidad: 25, precio: 96 }]],
    ['VTA-2026-0113', 1, -70, 'Martín Gómez', [{ prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 120, precio: 42 }]],
    ['VTA-2026-0114', 3, -95, 'Martín Gómez', [{ prodIdx: 6, desc_text: 'Kit Análisis de Suelo', cantidad: 5, precio: 150 }]],
    ['VTA-2026-0115', 9, -120, 'Martín Gómez', [{ prodIdx: 5, desc_text: 'HumiCarbono Enmienda', cantidad: 40, precio: 65 }]],
    ['VTA-2026-0116', 2, -150, 'Sofía Ramírez', [{ prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 180, precio: 42 }]],
    ['VTA-2026-0117', 0, -200, 'Martín Gómez', [{ prodIdx: 0, desc_text: 'MicroFol Foliar 20L', cantidad: 40, precio: 185 }]],
    ['VTA-2026-0118', 4, -240, 'Sofía Ramírez', [{ prodIdx: 3, desc_text: 'ActivPhos Solubilizador', cantidad: 35, precio: 120 }]],
    ['VTA-2026-0119', 8, -300, 'Sofía Ramírez', [{ prodIdx: 4, desc_text: 'DefendBio Control Biológico', cantidad: 20, precio: 210 }]],
    ['VTA-2026-0120', 1, -330, 'Martín Gómez', [{ prodIdx: 1, desc_text: 'BioFix Inoculante Soja', cantidad: 100, precio: 42 }]],
  ];
  const createdSales = [];
  for (const s of salesSeed) createdSales.push(await createSale(...s));

  // Invoices linked to sales + collections (some paid, some pending/overdue)
  const insInvoice = db.prepare(`INSERT INTO invoices (client_id, sale_id, numero, fecha, fecha_vencimiento, importe, moneda, saldo, estado) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insCollection = db.prepare(`INSERT INTO collections (client_id, fecha, comprobante, factura, importe, moneda, medio_pago, fecha_vencimiento_original, responsable, observaciones) VALUES (?,?,?,?,?,?,?,?,?,?)`);

  for (let i = 0; i < createdSales.length; i++) {
    const s = createdSales[i];
    const sale = salesSeed[i];
    const clientIdx = sale[1];
    const fechaOff = sale[2];
    const vencOff = fechaOff + 30; // 30 días de plazo
    const invNum = `FC-2026-${1000 + i}`;
    let estado = 'Pendiente';
    let saldo = s.total;
    // Definir cobros: pagamos completo si la factura es de hace más de 40 días, salvo El Trigal (deuda vencida a propósito)
    const isTrigalOverdue = clientIdx === 4;
    if (vencOff < -35 && !isTrigalOverdue) {
      estado = 'Pagada';
      saldo = 0;
    } else if (vencOff < 0 && !isTrigalOverdue) {
      // vencida hace poco pero se cobró parcialmente algunas
      if (i % 3 === 0) { estado = 'Pagada'; saldo = 0; }
      else { estado = 'Vencida'; }
    } else if (vencOff < 0 && isTrigalOverdue) {
      estado = 'Vencida';
    }
    const invId = (await insInvoice.run(clientIds[clientIdx], s.sid, invNum, d(fechaOff), d(vencOff), s.total, 'USD', saldo, estado)).lastInsertRowid;
    if (estado === 'Pagada') {
      await insCollection.run(clientIds[clientIdx], d(vencOff - 2), `REC-${2000 + i}`, invNum, s.total, 'USD', i % 2 === 0 ? 'Transferencia bancaria' : 'Cheque', d(vencOff), sale[3], 'Cobranza registrada.');
    }
  }

  // El Trigal: deuda vencida explícita adicional (hito + factura + sin cobranza)
  const trigalInvId = (await insInvoice.run(clientIds[4], null, 'FC-2026-9001', d(-40), d(-10), 12500, 'USD', 12500, 'Vencida')).lastInsertRowid;

  // Payment commitments
  const insCommit = db.prepare(`INSERT INTO payment_commitments (client_id, importe_comprometido, moneda, fecha_comprometida, invoice_id, responsable, observaciones, estado) VALUES (?,?,?,?,?,?,?,?)`);
  await insCommit.run(clientIds[4], 12500, 'USD', d(3), trigalInvId, 'Sofía Ramírez', 'Compromiso verbal tras llamada de cobranza.', 'Pendiente');
  await insCommit.run(clientIds[7], 4000, 'USD', d(-10), null, 'Martín Gómez', 'Compromiso incumplido, cliente inactivo.', 'Incumplido');

  // Tasks
  const insTask = db.prepare(`INSERT INTO tasks (titulo, client_id, fecha, hora, prioridad, responsable, descripcion, estado) VALUES (?,?,?,?,?,?,?,?)`);
  const taskSeed = [
    ['Llamar para cerrar cotización COT-2026-0031', 0, 0, '10:00', 'Alta', 'Martín Gómez', 'Confirmar condiciones y cerrar venta.', 'Pendiente'],
    ['Visita técnica a lote piloto', 3, 0, '15:00', 'Media', 'Martín Gómez', 'Evaluar resultados de NutriRaiz.', 'Pendiente'],
    ['Gestión de cobranza factura vencida', 4, 0, '11:30', 'Alta', 'Sofía Ramírez', 'Confirmar compromiso de pago.', 'Pendiente'],
    ['Enviar catálogo actualizado', 5, -1, '09:00', 'Baja', 'Martín Gómez', '', 'Vencida'],
    ['Seguimiento pedido mensual', 2, 0, '12:00', 'Media', 'Sofía Ramírez', '', 'Pendiente'],
    ['Preparar propuesta AgroFuturo', 0, 1, '10:00', 'Media', 'Martín Gómez', 'Prospecto interesado en bioestimulantes.', 'Pendiente'],
    ['Reunión de cierre Aráoz', 0, -2, '16:00', 'Alta', 'Martín Gómez', '', 'Completada'],
  ];
  for (const t of taskSeed) await insTask.run(t[0], clientIds[t[1]] ?? null, d(t[2]), t[3], t[4], t[5], t[6], t[7]);

  // Calendar events
  const insCal = db.prepare(`INSERT INTO calendar_events (titulo, client_id, fecha, hora, tipo, descripcion, prioridad, recordatorio, estado) VALUES (?,?,?,?,?,?,?,?,?)`);
  const calSeed = [
    ['Reunión técnica AgroNorte', 2, 1, '11:00', 'Reunion', 'Definir pedido trimestral.', 'Alta', '1 hora antes', 'Pendiente'],
    ['Visita a campo Campos del Sur', 3, 2, '09:30', 'Visita', 'Revisión de lote piloto NutriRaiz.', 'Media', '1 dia antes', 'Pendiente'],
    ['Llamada de cobranza El Trigal', 4, 0, '14:00', 'Cobranza', 'Confirmar compromiso de pago.', 'Alta', '30 minutos antes', 'Pendiente'],
    ['Seguimiento prospecto Aráoz', null, -1, '10:00', 'Seguimiento', '', 'Media', '15 minutos antes', 'Completada'],
    ['Envío de cotización Chacra Los Aromos', 9, 3, '10:00', 'Cotizacion', '', 'Media', '1 dia antes', 'Pendiente'],
  ];
  for (const c of calSeed) await insCal.run(c[0], c[1] !== null ? clientIds[c[1]] : null, d(c[2]), c[3], c[4], c[5], c[6], c[7], c[8]);

  console.log(`Seed completo: ${clientIds.length} clientes, ${prospectIds.length} prospectos, ${createdSales.length} ventas.`);
}

export { clearAll, clearBusinessData, seed, run };

// Solo se ejecuta automáticamente cuando este archivo se corre directo como script
// (ej. "npm run seed"), no cuando otro módulo lo importa (ej. la ruta /api/admin/seed).
const isMain = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isMain) {
  const force = process.argv.includes('--force');
  await initDb();
  if (force) await clearAll();
  await seed();
}
