import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { Card, Button, Modal, Field, inputCls, Loading, EmptyState, fmtUSD, fmtDate } from '../components/UI.jsx';
import { Plus, Download } from 'lucide-react';

export default function Sales() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', vendedor: '', anio: '', mes: '' });
  const [showNew, setShowNew] = useState(!!params.get('client_id'));

  async function load() {
    setLoading(true);
    const params2 = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const [s, c, p] = await Promise.all([
      api.get('/sales', { params: params2 }),
      api.get('/clients', { params: { pageSize: 200 } }),
      api.get('/products'),
    ]);
    setRows(s.data);
    setClients(c.data.rows);
    setProducts(p.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filters]);

  const totalPeriodo = rows.reduce((s, r) => s + r.total, 0);
  const vendedores = [...new Set(rows.map(r => r.vendedor).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Ventas</h1>
          <p className="text-sm text-gray-500">{rows.length} operaciones · Total: {fmtUSD(totalPeriodo)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.open('/api/export/sales?format=xlsx', '_blank')}><Download size={14} className="inline mr-1" /> Exportar</Button>
          <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Registrar venta</Button>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input className={inputCls} placeholder="Buscar por número o cliente..." value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
        <select className={inputCls} value={filters.vendedor} onChange={e => setFilters(f => ({ ...f, vendedor: e.target.value }))}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input className={inputCls} type="number" placeholder="Año" value={filters.anio} onChange={e => setFilters(f => ({ ...f, anio: e.target.value }))} />
        <input className={inputCls} type="number" placeholder="Mes (1-12)" value={filters.mes} onChange={e => setFilters(f => ({ ...f, mes: e.target.value }))} />
      </Card>

      <Card className="overflow-x-auto">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState text="No hay ventas con estos filtros." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Número</th>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Vendedor</th>
                <th className="text-left px-4 py-2.5">Localidad</th>
                <th className="text-right px-4 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{s.numero}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.cliente_nombre}</td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(s.fecha)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.vendedor}</td>
                  <td className="px-4 py-2.5 text-gray-500">{s.localidad}, {s.provincia}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtUSD(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showNew && (
        <SaleFormModal
          clients={clients}
          products={products}
          defaultClientId={params.get('client_id')}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}

function SaleFormModal({ clients, products, defaultClientId, onClose, onSaved }) {
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [vendedor, setVendedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState([{ product_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 }]);

  function updateItem(i, patch) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it)); }
  function addItem() { setItems(prev => [...prev, { product_id: '', descripcion: '', cantidad: 1, precio_unitario: 0 }]); }
  function removeItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function selectProduct(i, productId) {
    const prod = products.find(p => String(p.id) === productId);
    updateItem(i, { product_id: productId, descripcion: prod?.nombre || '', precio_unitario: prod?.precio_unitario || 0 });
  }

  const total = items.reduce((s, it) => s + (Number(it.cantidad) * Number(it.precio_unitario)), 0);

  async function save(e) {
    e.preventDefault();
    if (!clientId) return alert('Seleccioná un cliente');
    await api.post('/sales', { client_id: clientId, fecha, vendedor, items, observaciones, usuario: 'Usuario' });
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Registrar venta" width="max-w-3xl">
      <form onSubmit={save}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cliente *">
            <select required className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input type="date" className={inputCls} value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
          <Field label="Vendedor"><input className={inputCls} value={vendedor} onChange={e => setVendedor(e.target.value)} /></Field>
        </div>

        <div className="mt-2">
          <div className="text-xs font-medium text-gray-600 mb-1">Productos</div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select className={inputCls + ' col-span-4'} value={it.product_id} onChange={e => selectProduct(i, e.target.value)}>
                  <option value="">Producto libre...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input className={inputCls + ' col-span-4'} placeholder="Descripción" value={it.descripcion} onChange={e => updateItem(i, { descripcion: e.target.value })} />
                <input type="number" className={inputCls + ' col-span-1'} placeholder="Cant." value={it.cantidad} onChange={e => updateItem(i, { cantidad: e.target.value })} />
                <input type="number" className={inputCls + ' col-span-2'} placeholder="Precio" value={it.precio_unitario} onChange={e => updateItem(i, { precio_unitario: e.target.value })} />
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-red-500 text-xs">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-xs text-blue-600 mt-2 hover:underline">+ Agregar producto</button>
        </div>

        <Field label="Observaciones"><textarea className={inputCls} rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></Field>
        <div className="text-right font-semibold text-lg mt-2">Total: {fmtUSD(total)}</div>

        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Registrar venta</Button>
        </div>
      </form>
    </Modal>
  );
}
