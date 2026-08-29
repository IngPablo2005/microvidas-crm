import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtPrecio } from '../components/UI.jsx';
import { Plus, Pencil, Trash2, RotateCcw, Image as ImageIcon } from 'lucide-react';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingProveedor, setEditingProveedor] = useState(null);

  async function load() {
    setLoading(true);
    const [p, pr] = await Promise.all([
      api.get('/products', { params: { all: 1 } }),
      api.get('/products/proveedores/list'),
    ]);
    setProducts(p.data);
    setProveedores(pr.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const visibleProducts = showInactive ? products : products.filter(p => p.activo);

  const groups = [];
  const byProveedor = new Map();
  for (const p of visibleProducts) {
    const key = p.proveedor_id || 'none';
    if (!byProveedor.has(key)) byProveedor.set(key, []);
    byProveedor.get(key).push(p);
  }
  for (const pr of proveedores) {
    if (byProveedor.has(pr.id)) groups.push({ proveedor: pr, items: byProveedor.get(pr.id) });
  }
  if (byProveedor.has('none')) groups.push({ proveedor: null, items: byProveedor.get('none') });

  async function toggleActivo(p) {
    await api.put(`/products/${p.id}`, { ...p, activo: p.activo ? 0 : 1 });
    load();
  }

  async function deleteProveedor(pr) {
    if (!window.confirm(`¿Borrar el proveedor "${pr.nombre}"? Sólo se puede si no tiene productos activos.`)) return;
    try {
      await api.delete(`/products/proveedores/${pr.id}`);
      load();
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo borrar el proveedor.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Catálogo de productos</h1>
          <p className="text-sm text-gray-500">{visibleProducts.length} productos · usado en Cotizaciones y Ventas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNewProduct(true)}><Plus size={14} className="inline mr-1" /> Nuevo producto</Button>
        </div>
      </div>

      <Card className="p-3 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Mostrar productos desactivados
        </label>
      </Card>

      {loading ? <Loading /> : groups.length === 0 ? <EmptyState text="Todavía no hay productos cargados." /> : (
        <div className="space-y-4">
          {groups.map(g => (
            <Card key={g.proveedor?.id || 'none'} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {g.proveedor?.logo_data_url ? (
                    <img src={g.proveedor.logo_data_url} alt={g.proveedor.nombre} className="h-8 max-w-[120px] object-contain" />
                  ) : g.proveedor ? (
                    <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-300"><ImageIcon size={16} /></div>
                  ) : null}
                  <div className="text-sm font-semibold text-gray-700">{g.proveedor ? g.proveedor.nombre : 'Sin proveedor / cargados a mano'}</div>
                </div>
                {g.proveedor && (
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditingProveedor(g.proveedor)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Pencil size={12} /> Editar</button>
                    <button onClick={() => deleteProveedor(g.proveedor)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={12} /> Borrar proveedor</button>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 uppercase">
                  <tr>
                    <th className="text-left py-1 px-2 pl-0">Producto</th>
                    <th className="text-left py-1 px-2">Categoría</th>
                    <th className="text-right py-1 px-2">Precio lista</th>
                    <th className="text-left py-1 px-2">Unidad</th>
                    <th className="text-left py-1 px-2">Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(p => (
                    <tr key={p.id} className={`border-t border-gray-50 ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className="py-1.5 px-2 pl-0">
                        {p.logo_data_url ? (
                          // Si hay logo cargado se muestra sólo el logo (sin el nombre al lado)
                          // para que se pueda ver bien grande y sea notable; el nombre queda
                          // disponible al pasar el mouse. Sin ancho fijo: un logo apaisado (lo
                          // más común) se aplasta a una franja diminuta si se lo encierra en una
                          // caja cuadrada chica, así que se fija sólo el alto y se deja un ancho
                          // máximo generoso, igual que el logo de proveedor arriba.
                          <img src={p.logo_data_url} alt={p.nombre} title={p.nombre} className="h-8 max-w-[130px] object-contain rounded" />
                        ) : (
                          <span>{p.nombre}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-gray-500">{p.categoria || '—'}</td>
                      <td className="py-1.5 px-2 text-right">{fmtPrecio(p.precio_unitario)} <span className="text-gray-400">{p.moneda}</span></td>
                      <td className="py-1.5 px-2 text-gray-500">{p.unidad}</td>
                      <td className="py-1.5 px-2"><Badge text={p.activo ? 'Activo' : 'Inactivo'} /></td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        <button onClick={() => setEditingProduct(p)} className="text-blue-600 hover:underline text-xs mr-3">Editar</button>
                        <button onClick={() => toggleActivo(p)} className={`text-xs hover:underline ${p.activo ? 'text-red-500' : 'text-green-600'}`}>
                          {p.activo ? <><Trash2 size={12} className="inline mr-0.5" /> Desactivar</> : <><RotateCcw size={12} className="inline mr-0.5" /> Reactivar</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}

      {(showNewProduct || editingProduct) && (
        <ProductFormModal
          proveedores={proveedores}
          editingProduct={editingProduct}
          onClose={() => { setShowNewProduct(false); setEditingProduct(null); }}
          onSaved={() => { setShowNewProduct(false); setEditingProduct(null); load(); }}
        />
      )}

      {editingProveedor && (
        <ProveedorFormModal
          proveedor={editingProveedor}
          onClose={() => setEditingProveedor(null)}
          onSaved={() => { setEditingProveedor(null); load(); }}
        />
      )}
    </div>
  );
}

function ProductFormModal({ proveedores, editingProduct, onClose, onSaved }) {
  const isEditing = !!editingProduct;
  const [form, setForm] = useState({
    nombre: editingProduct?.nombre || '',
    categoria: editingProduct?.categoria || '',
    precio_unitario: editingProduct?.precio_unitario ?? 0,
    moneda: editingProduct?.moneda || 'USD',
    unidad: editingProduct?.unidad || 'unidad',
    proveedor_id: editingProduct?.proveedor_id || '',
    activo: editingProduct?.activo ?? 1,
  });
  const [logo, setLogo] = useState(editingProduct?.logo_data_url || null);
  const logoFileRef = useRef(null);

  function onLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  }

  async function save(e) {
    e.preventDefault();
    const payload = { ...form, proveedor_id: form.proveedor_id || null, logo_data_url: logo };
    if (isEditing) await api.put(`/products/${editingProduct.id}`, payload);
    else await api.post('/products', payload);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={isEditing ? 'Editar producto' : 'Nuevo producto'}>
      <form onSubmit={save} className="space-y-1">
        <Field label="Nombre *"><input required className={inputCls} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></Field>
        <Field label="Categoría"><input className={inputCls} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de lista"><input type="number" step="any" className={inputCls} value={form.precio_unitario} onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))} /></Field>
          <Field label="Moneda">
            <select className={inputCls} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </Field>
        </div>
        <Field label="Unidad"><input className={inputCls} value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} /></Field>
        <Field label="Proveedor">
          <select className={inputCls} value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
            <option value="">Sin proveedor</option>
            {proveedores.map(pr => <option key={pr.id} value={pr.id}>{pr.nombre}</option>)}
          </select>
        </Field>
        <Field label="Logo del producto (opcional)">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-10 max-w-[140px] object-contain border border-gray-100 rounded" />
            ) : (
              <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-gray-300"><ImageIcon size={16} /></div>
            )}
            <Button type="button" variant="secondary" onClick={() => logoFileRef.current?.click()}>{logo ? 'Cambiar' : 'Subir logo'}</Button>
            {logo && <button type="button" onClick={() => setLogo(null)} className="text-xs text-red-500 hover:underline">Quitar</button>}
            <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
          </div>
        </Field>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{isEditing ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProveedorFormModal({ proveedor, onClose, onSaved }) {
  const [nombre, setNombre] = useState(proveedor.nombre);
  const [logo, setLogo] = useState(proveedor.logo_data_url || null);
  const fileRef = useRef(null);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  }

  async function save(e) {
    e.preventDefault();
    await api.put(`/products/proveedores/${proveedor.id}`, { nombre, logo_data_url: logo });
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Editar proveedor">
      <form onSubmit={save} className="space-y-1">
        <Field label="Nombre *"><input required className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} /></Field>
        <Field label="Logo">
          <div className="flex items-center gap-3">
            {logo ? <img src={logo} alt="" className="h-10 max-w-[140px] object-contain border border-gray-100 rounded" /> : <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-gray-300"><ImageIcon size={16} /></div>}
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Cambiar imagen</Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
        </Field>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  );
}

