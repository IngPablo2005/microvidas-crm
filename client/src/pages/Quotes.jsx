import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtPrecio, fmtDate } from '../components/UI.jsx';
import ClientPicker from '../components/ClientPicker.jsx';
import PasteTable from '../components/PasteTable.jsx';
import DateInput from '../components/DateInput.jsx';
import { Plus, Download, Pencil, FileText, Trash2 } from 'lucide-react';

const LOGO_SRC = '/branding/microvidas-logo.png';

const ESTADOS = ['Borrador', 'Enviada', 'En negociacion', 'Aceptada', 'Rechazada', 'Vencida'];
const MAX_ITEMS = 5;

// Títulos por defecto de la tabla de productos del cotizador — se pueden editar
// por cotización (queda guardado junto con esa cotización) y viajan tal cual al PDF.
const DEFAULT_ITEM_HEADERS = {
  producto: 'Producto', cantidad: 'Cantidad', precio_lista: 'Precio lista',
  descuento: 'Desc. (%)', precio_desc: 'Precio c/desc', financiado: 'Financiado', subtotal: 'Subtotal',
};

// El cuadro de notas (precio en USD+IVA, tipo de cambio, tarjetas, etc.) se
// escribe como una línea por fila con formato "Título: Detalle" — misma lógica
// de parseo que el servidor (server/src/routes/quotes.js) para el PDF.
function parseNotasTabla(text) {
  if (!text) return [];
  return text.split('\n').map(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return null;
    const label = line.slice(0, idx).trim();
    const detalle = line.slice(idx + 1).trim();
    if (!label || !detalle) return null;
    return { label, detalle };
  }).filter(Boolean);
}

function cantidadVacia(cantidad) {
  return cantidad === '' || cantidad === null || cantidad === undefined;
}

export default function Quotes() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [defaultCondiciones, setDefaultCondiciones] = useState('');
  const [defaultNotasTabla, setDefaultNotasTabla] = useState('');
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [showNew, setShowNew] = useState(!!params.get('client_id'));
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);

  // Se usa tanto en el load() general como cada vez que se abre el buscador de
  // clientes del formulario (ver ClientPicker onOpen más abajo), así un cliente
  // recién cargado en otra pestaña/pantalla aparece sin recargar toda la página.
  function refreshClients() {
    return api.get('/clients', { params: { pageSize: 200 } }).then(({ data }) => setClients(data.rows));
  }

  async function load() {
    setLoading(true);
    const [q, , p, s] = await Promise.all([
      api.get('/quotes', { params: estado ? { estado } : {} }),
      refreshClients(),
      api.get('/products'),
      api.get('/dashboard/settings'),
    ]);
    setRows(q.data);
    setProducts(p.data);
    setDefaultCondiciones(s.data.condiciones_comerciales_default || '');
    setDefaultNotasTabla(s.data.notas_tabla_default || '');
    setLoading(false);
  }
  useEffect(() => { load(); }, [estado]);

  async function changeStatus(id, nuevoEstado) {
    await api.patch(`/quotes/${id}/estado`, { estado: nuevoEstado, usuario: 'Usuario' });
    load();
    if (detail?.id === id) openDetail(id);
  }

  async function convertToSale(id) {
    if (!window.confirm('¿Convertir esta cotización en una venta?')) return;
    await api.post(`/quotes/${id}/convert-to-sale`, { usuario: 'Usuario' });
    load();
    setDetail(null);
  }

  async function deleteQuote(id, numero) {
    if (!window.confirm(`¿Eliminar la cotización ${numero}? Esta acción no se puede deshacer.`)) return;
    await api.delete(`/quotes/${id}`);
    setDetail(null);
    load();
  }

  async function openDetail(id) {
    const { data } = await api.get(`/quotes/${id}`);
    setDetail(data);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={LOGO_SRC} alt="Microvidas" className="h-8 hidden sm:block" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Cotizaciones</h1>
            <p className="text-sm text-gray-500">{rows.length} cotizaciones</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.open('/api/export/quotes?format=xlsx', '_blank')}><Download size={14} className="inline mr-1" /> Exportar</Button>
          <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Nueva cotización</Button>
        </div>
      </div>

      <Card className="p-4">
        <select className={inputCls + ' max-w-xs'} value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Card>

      <Card className="overflow-x-auto">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState text="No hay cotizaciones." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Número</th>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Vencimiento</th>
                <th className="text-right px-4 py-2.5">Total</th>
                <th className="text-left px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.id} onClick={() => openDetail(q.id)} className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{q.numero}</td>
                  <td className="px-4 py-2.5 text-gray-600">{q.cliente_nombre}</td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(q.fecha)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(q.fecha_vencimiento)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtPrecio(q.total)}</td>
                  <td className="px-4 py-2.5"><Badge text={q.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showNew && (
        <QuoteFormModal
          clients={clients}
          onOpenClientPicker={refreshClients}
          products={products}
          defaultClientId={params.get('client_id')}
          defaultCondiciones={defaultCondiciones}
          defaultNotasTabla={defaultNotasTabla}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}

      {detail && !editing && (
        <Modal open onClose={() => setDetail(null)} title={`Cotización ${detail.numero}`} width="max-w-2xl">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Empresa</div>
                <div className="text-lg font-semibold text-gray-800 leading-tight">{detail.cliente_nombre}</div>
                <div className="text-gray-400 text-sm mt-0.5">Vence: {fmtDate(detail.fecha_vencimiento)} · Responsable: {detail.responsable}</div>
              </div>
              <Badge text={detail.estado} />
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left py-1">{detail.item_headers?.producto || 'Producto'}</th>
                  <th className="text-right py-1">Cant.</th>
                  <th className="text-right py-1">{detail.item_headers?.precio_lista || 'Precio lista'}</th>
                  <th className="text-right py-1">{detail.item_headers?.financiado || 'Financiado'}</th>
                  <th className="text-right py-1">{detail.item_headers?.subtotal || 'Subtotal'}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map(it => (
                  <tr key={it.id} className="border-t border-gray-50">
                    <td className="py-1.5">
                      {it.producto_logo ? (
                        // Sólo el logo cuando está cargado (sin el nombre al lado), para que
                        // se vea grande; el nombre queda disponible al pasar el mouse.
                        <img src={it.producto_logo} alt={it.descripcion} title={it.descripcion} className="h-7 max-w-[100px] object-contain rounded" />
                      ) : (
                        <span>{it.descripcion}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">{cantidadVacia(it.cantidad) ? '—' : it.cantidad}</td>
                    <td className="py-1.5 text-right">{fmtPrecio(it.precio_unitario)}{it.descuento ? ` (-${it.descuento}%)` : ''}</td>
                    <td className="py-1.5 text-right">{it.financiado ? fmtPrecio(it.financiado) : '—'}</td>
                    <td className="py-1.5 text-right">{cantidadVacia(it.cantidad) ? '—' : fmtPrecio(it.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.items.some(it => !cantidadVacia(it.cantidad)) && (
              <div className="text-right font-semibold">Total: {fmtPrecio(detail.total)}</div>
            )}
            {detail.total_financiado > 0 && <div className="text-right text-sm text-gray-500">Total financiado: {fmtPrecio(detail.total_financiado)}</div>}
            {detail.condiciones_comerciales && (
              <div className="text-sm bg-gray-50 rounded-md p-3">
                <div className="text-xs font-semibold text-gray-600 mb-1">Condiciones comerciales</div>
                <div className="text-gray-600 whitespace-pre-wrap">{detail.condiciones_comerciales}</div>
              </div>
            )}
            {detail.observaciones && <div className="text-sm text-gray-500 italic">{detail.observaciones}</div>}
            {parseNotasTabla(detail.notas_tabla).length > 0 && (
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="w-full text-sm">
                  <tbody>
                    {parseNotasTabla(detail.notas_tabla).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 first:border-t-0">
                        <td className="px-3 py-1.5 font-semibold text-gray-700 bg-gray-50 w-1/3 align-top">{row.label}</td>
                        <td className="px-3 py-1.5 text-gray-600 align-top">{row.detalle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detail.tabla_pegada?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Información adicional</div>
                <div className="overflow-x-auto rounded-md border border-gray-200">
                  <table className="text-sm w-full">
                    <tbody>
                      {detail.tabla_pegada.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 first:border-t-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 border-r border-gray-100 last:border-r-0 text-gray-600 align-top whitespace-pre-wrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => window.open(`/api/quotes/${detail.id}/pdf`, '_blank')}><FileText size={13} className="inline mr-1" /> Descargar PDF</Button>
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} className="inline mr-1" /> Editar cotización</Button>
              {ESTADOS.filter(s => s !== detail.estado).map(s => (
                <Button key={s} variant="secondary" onClick={() => changeStatus(detail.id, s)}>Marcar {s}</Button>
              ))}
              <Button onClick={() => convertToSale(detail.id)}>Convertir en venta</Button>
              <Button variant="danger" onClick={() => deleteQuote(detail.id, detail.numero)}><Trash2 size={13} className="inline mr-1" /> Eliminar</Button>
            </div>
          </div>
        </Modal>
      )}

      {detail && editing && (
        <QuoteFormModal
          clients={clients}
          products={products}
          editingQuote={detail}
          defaultCondiciones={defaultCondiciones}
          defaultNotasTabla={defaultNotasTabla}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

// La cantidad arranca vacía (no en 1): es opcional, y el monto de la línea sólo
// se calcula/muestra si se anota una cantidad.
function emptyItem() { return { product_id: '', descripcion: '', cantidad: '', precio_unitario: 0, descuento: 0, financiado: 0 }; }

function QuoteFormModal({ clients, onOpenClientPicker, products, defaultClientId, defaultCondiciones, defaultNotasTabla, editingQuote, onClose, onSaved }) {
  const isEditing = !!editingQuote;
  const [clientId, setClientId] = useState(editingQuote?.client_id || defaultClientId || '');
  const [fechaVencimiento, setFechaVencimiento] = useState(editingQuote?.fecha_vencimiento?.slice(0, 10) || '');
  const [responsable, setResponsable] = useState(editingQuote?.responsable || '');
  const [observaciones, setObservaciones] = useState(editingQuote?.observaciones || '');
  const [condicionesComerciales, setCondicionesComerciales] = useState(
    editingQuote?.condiciones_comerciales ?? defaultCondiciones ?? ''
  );
  const [notasTabla, setNotasTabla] = useState(
    editingQuote?.notas_tabla ?? defaultNotasTabla ?? ''
  );
  const [tablaPegada, setTablaPegada] = useState(
    editingQuote?.tabla_pegada?.length ? editingQuote.tabla_pegada : null
  );
  const [headers, setHeaders] = useState({ ...DEFAULT_ITEM_HEADERS, ...(editingQuote?.item_headers || {}) });
  const [items, setItems] = useState(
    editingQuote?.items?.length
      ? editingQuote.items.map(it => ({ product_id: it.product_id || '', descripcion: it.descripcion, cantidad: it.cantidad ?? '', precio_unitario: it.precio_unitario, descuento: it.descuento || 0, financiado: it.financiado || 0 }))
      : [emptyItem()]
  );
  // Antes, si la creación fallaba en el servidor (ej. el bug del número de
  // cotización duplicado, ya corregido), no había ningún aviso: el botón parecía
  // no hacer nada. Ahora se muestra el error y se deshabilita el botón mientras
  // se guarda, para evitar además el doble clic accidental.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function updateItem(i, patch) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function updateHeader(key, value) { setHeaders(prev => ({ ...prev, [key]: value })); }
  function addItem() { if (items.length < MAX_ITEMS) setItems(prev => [...prev, emptyItem()]); }
  function removeItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function selectProduct(i, productId) {
    const prod = products.find(p => String(p.id) === productId);
    updateItem(i, { product_id: productId, descripcion: prod?.nombre || '', precio_unitario: prod?.precio_unitario || 0 });
  }

  const total = items.reduce((s, it) => s + (cantidadVacia(it.cantidad) ? 0 : Number(it.cantidad) * Number(it.precio_unitario) * (1 - (Number(it.descuento) || 0) / 100)), 0);
  const totalFinanciado = items.reduce((s, it) => s + (cantidadVacia(it.cantidad) ? 0 : Number(it.cantidad) * (Number(it.financiado) || 0)), 0);
  // Si ninguna línea tiene cantidad cargada, el total da 0 sólo porque todas están
  // anotadas sin comprometer un monto — en ese caso no se muestra "Total: US$0".
  const anyCantidad = items.some(it => !cantidadVacia(it.cantidad));
  const clienteActual = clients.find(c => String(c.id) === String(clientId));

  async function save(e) {
    e.preventDefault();
    if (!clientId) return alert('Seleccioná un cliente');
    if (saving) return; // evita doble envío si se hace doble clic
    setSaving(true);
    setSaveError('');
    const payload = { fecha_vencimiento: fechaVencimiento, items, responsable, observaciones, condiciones_comerciales: condicionesComerciales, notas_tabla: notasTabla, item_headers: headers, tabla_pegada: tablaPegada, usuario: 'Usuario' };
    try {
      if (isEditing) {
        await api.put(`/quotes/${editingQuote.id}`, payload);
      } else {
        await api.post('/quotes', { client_id: clientId, ...payload });
      }
      onSaved();
    } catch (err) {
      setSaveError('No se pudo guardar la cotización. Probá de nuevo en unos segundos; si el problema sigue, avisale a soporte.');
      setSaving(false);
    }
  }

  const headerInputCls = 'w-full bg-transparent text-[11px] font-semibold uppercase text-white placeholder-green-100 focus:outline-none focus:bg-green-800/40 rounded px-1 py-0.5';
  const cellInputCls = 'w-full px-1.5 py-1 text-sm rounded border border-transparent hover:border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

  return (
    <Modal open onClose={onClose} title={isEditing ? `Editar cotización ${editingQuote.numero}` : 'Nueva cotización'} width="max-w-5xl">
      <form onSubmit={save}>
        {clienteActual && (
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Empresa</div>
            <div className="text-lg font-semibold text-gray-800 leading-tight">{clienteActual.razon_social}</div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cliente *">
            {isEditing ? (
              <input disabled className={inputCls + ' bg-gray-50 text-gray-500'} value={clienteActual?.razon_social || editingQuote.cliente_nombre || ''} />
            ) : (
              <ClientPicker clients={clients} value={clientId} onChange={setClientId} onOpen={onOpenClientPicker} />
            )}
          </Field>
          <Field label="Vencimiento"><DateInput className={inputCls} value={fechaVencimiento} onChange={v => setFechaVencimiento(v)} /></Field>
          <Field label="Responsable"><input className={inputCls} value={responsable} onChange={e => setResponsable(e.target.value)} /></Field>
        </div>

        <div className="mt-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            Productos (hasta {MAX_ITEMS}) — elegí uno de la lista precargada o escribí uno libre; los títulos de columna también se pueden editar.
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm min-w-[900px]">
              <thead style={{ backgroundColor: '#1e5f3c' }}>
                <tr>
                  <th className="text-left px-2 py-1.5 w-[230px]"><input className={headerInputCls} value={headers.producto} onChange={e => updateHeader('producto', e.target.value)} /></th>
                  <th className="text-right px-2 py-1.5 w-[80px]"><input className={headerInputCls + ' text-right'} value={headers.cantidad} onChange={e => updateHeader('cantidad', e.target.value)} /></th>
                  <th className="text-right px-2 py-1.5 w-[115px]"><input className={headerInputCls + ' text-right'} value={headers.precio_lista} onChange={e => updateHeader('precio_lista', e.target.value)} /></th>
                  <th className="text-right px-2 py-1.5 w-[85px]"><input className={headerInputCls + ' text-right'} value={headers.descuento} onChange={e => updateHeader('descuento', e.target.value)} /></th>
                  <th className="text-right px-2 py-1.5 w-[115px]"><input className={headerInputCls + ' text-right'} value={headers.precio_desc} onChange={e => updateHeader('precio_desc', e.target.value)} /></th>
                  <th className="text-right px-2 py-1.5 w-[115px]"><input className={headerInputCls + ' text-right'} value={headers.financiado} onChange={e => updateHeader('financiado', e.target.value)} /></th>
                  <th className="text-right px-2 py-1.5 w-[115px]"><input className={headerInputCls + ' text-right'} value={headers.subtotal} onChange={e => updateHeader('subtotal', e.target.value)} /></th>
                  <th className="w-[30px]"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const precioDesc = Number(it.precio_unitario) * (1 - (Number(it.descuento) || 0) / 100);
                  const sinCantidad = cantidadVacia(it.cantidad);
                  const importe = sinCantidad ? null : Number(it.cantidad) * precioDesc;
                  const productoSeleccionado = products.find(p => String(p.id) === String(it.product_id));
                  return (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1 align-top">
                        <div className="flex items-center gap-1.5 mb-1">
                          {productoSeleccionado?.logo_data_url && (
                            <img src={productoSeleccionado.logo_data_url} alt="" className="h-8 max-w-[100px] object-contain rounded flex-shrink-0" />
                          )}
                          <select className={cellInputCls} value={it.product_id} onChange={e => selectProduct(i, e.target.value)}>
                            <option value="">Producto libre...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </div>
                        <input className={cellInputCls} placeholder="Descripción" value={it.descripcion} onChange={e => updateItem(i, { descripcion: e.target.value })} />
                      </td>
                      <td className="px-2 py-1 align-top"><input type="number" step="any" placeholder="Opcional" className={cellInputCls + ' text-right'} value={it.cantidad} onChange={e => updateItem(i, { cantidad: e.target.value })} /></td>
                      <td className="px-2 py-1 align-top"><input type="number" step="any" className={cellInputCls + ' text-right'} value={it.precio_unitario} onChange={e => updateItem(i, { precio_unitario: e.target.value })} /></td>
                      <td className="px-2 py-1 align-top"><input type="number" step="any" className={cellInputCls + ' text-right'} value={it.descuento} onChange={e => updateItem(i, { descuento: e.target.value })} /></td>
                      <td className="px-2 py-1 align-top text-right text-gray-500">{fmtPrecio(precioDesc)}</td>
                      <td className="px-2 py-1 align-top"><input type="number" step="any" className={cellInputCls + ' text-right'} value={it.financiado} onChange={e => updateItem(i, { financiado: e.target.value })} /></td>
                      <td className="px-2 py-1 align-top text-right font-medium text-gray-700">{sinCantidad ? '—' : fmtPrecio(importe)}</td>
                      <td className="px-2 py-1 align-top text-center">
                        <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {items.length < MAX_ITEMS ? (
            <button type="button" onClick={addItem} className="text-xs text-blue-600 mt-2 hover:underline">+ Agregar producto</button>
          ) : (
            <div className="text-xs text-gray-400 mt-2">Máximo {MAX_ITEMS} productos por cotización.</div>
          )}
          <div className="text-xs text-gray-400 mt-1">La cantidad es opcional: si se deja en blanco, esa línea queda anotada pero no suma al total.</div>
        </div>

        <Field label="Condiciones comerciales">
          <textarea className={inputCls} rows={3} value={condicionesComerciales} onChange={e => setCondicionesComerciales(e.target.value)} placeholder="Forma de pago, plazos de entrega, validez, etc." />
        </Field>
        <Field label="Observaciones"><textarea className={inputCls} rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></Field>
        <Field label="Notas (cuadro debajo de condiciones comerciales)">
          <textarea
            className={inputCls} rows={3}
            value={notasTabla} onChange={e => setNotasTabla(e.target.value)}
            placeholder="Una línea por fila, con formato Título: Detalle. Ej: Precio en Dólares + IVA: Sujeto a modificaciones sin previo aviso."
          />
        </Field>
        <Field label="Información adicional (pegar tabla de Word o Excel)">
          <PasteTable value={tablaPegada} onChange={setTablaPegada} />
        </Field>

        {(anyCantidad || totalFinanciado > 0) && (
          <div className="text-right mt-2">
            {anyCantidad && <div className="font-semibold text-lg">Total: {fmtPrecio(total)}</div>}
            {totalFinanciado > 0 && <div className="text-sm text-gray-500">Total financiado: {fmtPrecio(totalFinanciado)}</div>}
          </div>
        )}

        {saveError && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mt-2">{saveError}</div>}

        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Crear cotización')}</Button>
        </div>
      </form>
    </Modal>
  );
}
