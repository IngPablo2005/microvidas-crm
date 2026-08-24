import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtUSD, fmtDate } from '../components/UI.jsx';
import { Plus, Download, Pencil } from 'lucide-react';

const ESTADOS = ['Borrador', 'Enviada', 'En negociacion', 'Aceptada', 'Rechazada', 'Vencida'];
const MAX_ITEMS = 5;

export default function Quotes() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [showNew, setShowNew] = useState(!!params.get('client_id'));
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    const [q, c, p] = await Promise.all([
      api.get('/quotes', { params: estado ? { estado } : {} }),
      api.get('/clients', { params: { pageSize: 200 } }),
      api.get('/products'),
    ]);
    setRows(q.data);
    setClients(c.data.rows);
    setProducts(p.data);
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

  async function openDetail(id) {
    const { data } = await api.get(`/quotes/${id}`);
    setDetail(data);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Cotizaciones</h1>
          <p className="text-sm text-gray-500">{rows.length} cotizaciones</p>
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
                  <td className="px-4 py-2.5 text-right font-medium">{fmtUSD(q.total)}</td>
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
          products={products}
          defaultClientId={params.get('client_id')}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}

      {detail && !editing && (
        <Modal open onClose={() => setDetail(null)} title={`Cotización ${detail.numero}`} width="max-w-2xl">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-medium text-gray-800">{detail.cliente_nombre}</div>
                <div className="text-gray-400">Vence: {fmtDate(detail.fecha_vencimiento)} · Responsable: {detail.responsable}</div>
              </div>
              <Badge text={detail.estado} />
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 uppercase"><tr><th className="text-left py-1">Producto</th><th className="text-right py-1">Cant.</th><th className="text-right py-1">Precio (U$)</th><th className="text-right py-1">Desc.</th><th className="text-right py-1">Importe (U$)</th></tr></thead>
              <tbody>
                {detail.items.map(it => (
                  <tr key={it.id} className="border-t border-gray-50">
                    <td className="py-1.5">{it.descripcion}</td>
                    <td className="py-1.5 text-right">{it.cantidad}</td>
                    <td className="py-1.5 text-right">{fmtUSD(it.precio_unitario)}</td>
                    <td className="py-1.5 text-right">{it.descuento}%</td>
                    <td className="py-1.5 text-right">{fmtUSD(it.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-semibold">Total: {fmtUSD(detail.total)}</div>
            {detail.observaciones && <div className="text-sm text-gray-500 italic">{detail.observaciones}</div>}
            <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} className="inline mr-1" /> Editar cotización</Button>
              {ESTADOS.filter(s => s !== detail.estado).map(s => (
                <Button key={s} variant="secondary" onClick={() => changeStatus(detail.id, s)}>Marcar {s}</Button>
              ))}
              <Button onClick={() => convertToSale(detail.id)}>Convertir en venta</Button>
            </div>
          </div>
        </Modal>
      )}

      {detail && editing && (
        <QuoteFormModal
          clients={clients}
          products={products}
          editingQuote={detail}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

function QuoteFormModal({ clients, products, defaultClientId, editingQuote, onClose, onSaved }) {
  const isEditing = !!editingQuote;
  const [clientId, setClientId] = useState(editingQuote?.client_id || defaultClientId || '');
  const [fechaVencimiento, setFechaVencimiento] = useState(editingQuote?.fecha_vencimiento?.slice(0, 10) || '');
  const [responsable, setResponsable] = useState(editingQuote?.responsable || '');
  const [observaciones, setObservaciones] = useState(editingQuote?.observaciones || '');
  const [items, setItems] = useState(
    editingQuote?.items?.length
      ? editingQuote.items.map(it => ({ product_id: it.product_id || '', descripcion: it.descripcion, cantidad: it.cantidad, precio_unitario: it.precio_unitario, descuento: it.descuento || 0 }))
      : [{ product_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0 }]
  );

  function updateItem(i, patch) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() { if (items.length < MAX_ITEMS) setItems(prev => [...prev, { product_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0 }]); }
  function removeItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function selectProduct(i, productId) {
    const prod = products.find(p => String(p.id) === productId);
    updateItem(i, { product_id: productId, descripcion: prod?.nombre || '', precio_unitario: prod?.precio_unitario || 0 });
  }

  const total = items.reduce((s, it) => s + (Number(it.cantidad) * Number(it.precio_unitario) * (1 - (Number(it.descuento) || 0) / 100)), 0);
  const clienteActual = clients.find(c => String(c.id) === String(clientId));

  async function save(e) {
    e.preventDefault();
    if (!clientId) return alert('Seleccioná un cliente');
    if (isEditing) {
      await api.put(`/quotes/${editingQuote.id}`, { fecha_vencimiento: fechaVencimiento, items, responsable, observaciones, usuario: 'Usuario' });
    } else {
      await api.post('/quotes', { client_id: clientId, fecha_vencimiento: fechaVencimiento, items, responsable, observaciones, usuario: 'Usuario' });
    }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={isEditing ? `Editar cotización ${editingQuote.numero}` : 'Nueva cotización'} width="max-w-3xl">
      <form onSubmit={save}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cliente *">
            {isEditing ? (
              <input disabled className={inputCls + ' bg-gray-50 text-gray-500'} value={clienteActual?.razon_social || editingQuote.cliente_nombre || ''} />
            ) : (
              <select required className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            )}
          </Field>
          <Field label="Vencimiento"><input type="date" className={inputCls} value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} /></Field>
          <Field label="Responsable"><input className={inputCls} value={responsable} onChange={e => setResponsable(e.target.value)} /></Field>
        </div>

        <div className="mt-2">
          <div className="text-xs font-medium text-gray-600 mb-1">Productos (hasta {MAX_ITEMS})</div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select className={inputCls + ' col-span-4'} value={it.product_id} onChange={e => selectProduct(i, e.target.value)}>
                  <option value="">Producto libre...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input className={inputCls + ' col-span-3'} placeholder="Descripción" value={it.descripcion} onChange={e => updateItem(i, { descripcion: e.target.value })} />
                <input type="number" className={inputCls + ' col-span-1'} placeholder="Cant." value={it.cantidad} onChange={e => updateItem(i, { cantidad: e.target.value })} />
                <input type="number" className={inputCls + ' col-span-2'} placeholder="Precio" value={it.precio_unitario} onChange={e => updateItem(i, { precio_unitario: e.target.value })} />
                <input type="number" className={inputCls + ' col-span-1'} placeholder="Desc %" value={it.descuento} onChange={e => updateItem(i, { descuento: e.target.value })} />
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-red-500 text-xs">✕</button>
              </div>
            ))}
          </div>
          {items.length < MAX_ITEMS ? (
            <button type="button" onClick={addItem} className="text-xs text-blue-600 mt-2 hover:underline">+ Agregar producto</button>
          ) : (
            <div className="text-xs text-gray-400 mt-2">Máximo {MAX_ITEMS} productos por cotización.</div>
          )}
        </div>

        <Field label="Observaciones"><textarea className={inputCls} rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></Field>

        <div className="text-right font-semibold text-lg mt-2">Total: {fmtUSD(total)}</div>

        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{isEditing ? 'Guardar cambios' : 'Crear cotización'}</Button>
        </div>
      </form>
    </Modal>
  );
}
