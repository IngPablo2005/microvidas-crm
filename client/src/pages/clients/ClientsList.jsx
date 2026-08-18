import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState } from '../../components/UI.jsx';
import { Plus, Download, Upload } from 'lucide-react';

const ESTADOS = ['Activo', 'Inactivo', 'Perdido'];
const POTENCIALES = ['Alto', 'Medio', 'Bajo'];

const emptyClient = {
  razon_social: '', nombre_comercial: '', cuit: '', contacto_principal: '', cargo: '', telefono: '', whatsapp: '',
  email: '', provincia: '', localidad: '', direccion: '', tipo_cliente: '', segmento: '', estado: 'Activo',
  potencial_comercial: 'Medio', responsable_comercial: '', observaciones: '',
};

export default function ClientsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', estado: '', provincia: '' });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const [provincias, setProvincias] = useState([]);

  async function load() {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const { data } = await api.get('/clients', { params });
    setRows(data.rows);
    setProvincias([...new Set(data.rows.map(r => r.provincia).filter(Boolean))]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filters]);

  async function createClient(e) {
    e.preventDefault();
    const { data } = await api.post('/clients', form);
    setShowNew(false);
    setForm(emptyClient);
    navigate(`/clientes/${data.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-500">{rows.length} clientes encontrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/importar')}><Upload size={14} className="inline mr-1" /> Importar</Button>
          <Button variant="secondary" onClick={() => window.open('/api/export/clients?format=xlsx', '_blank')}><Download size={14} className="inline mr-1" /> Exportar</Button>
          <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Nuevo cliente</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className={inputCls} placeholder="Buscar por razón social, CUIT, contacto..." value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
          <select className={inputCls} value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputCls} value={filters.provincia} onChange={e => setFilters(f => ({ ...f, provincia: e.target.value }))}>
            <option value="">Todas las provincias</option>
            {provincias.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState text="No hay clientes con estos filtros." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Razón social</th>
                <th className="text-left px-4 py-2.5">Contacto</th>
                <th className="text-left px-4 py-2.5">Localidad</th>
                <th className="text-left px-4 py-2.5">Responsable</th>
                <th className="text-left px-4 py-2.5">Potencial</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Próximo contacto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.razon_social}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.contacto_principal}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.localidad}{c.provincia ? `, ${c.provincia}` : ''}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.responsable_comercial}</td>
                  <td className="px-4 py-2.5"><Badge text={c.potencial_comercial || '—'} colorKey={c.potencial_comercial === 'Alto' ? 'Activo' : c.potencial_comercial === 'Bajo' ? 'Perdido' : 'Contactado'} /></td>
                  <td className="px-4 py-2.5"><Badge text={c.estado} /></td>
                  <td className="px-4 py-2.5 text-gray-500">{c.proximo_contacto || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo cliente" width="max-w-2xl">
        <form onSubmit={createClient} className="grid grid-cols-2 gap-x-4">
          <Field label="Razón social *"><input required className={inputCls} value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} /></Field>
          <Field label="Nombre comercial"><input className={inputCls} value={form.nombre_comercial} onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))} /></Field>
          <Field label="CUIT"><input className={inputCls} value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} /></Field>
          <Field label="Contacto principal"><input className={inputCls} value={form.contacto_principal} onChange={e => setForm(f => ({ ...f, contacto_principal: e.target.value }))} /></Field>
          <Field label="Cargo"><input className={inputCls} value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} /></Field>
          <Field label="Teléfono"><input className={inputCls} value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></Field>
          <Field label="WhatsApp"><input className={inputCls} value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Provincia"><input className={inputCls} value={form.provincia} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} /></Field>
          <Field label="Localidad"><input className={inputCls} value={form.localidad} onChange={e => setForm(f => ({ ...f, localidad: e.target.value }))} /></Field>
          <Field label="Dirección"><input className={inputCls} value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} /></Field>
          <Field label="Tipo de cliente"><input className={inputCls} value={form.tipo_cliente} onChange={e => setForm(f => ({ ...f, tipo_cliente: e.target.value }))} /></Field>
          <Field label="Segmento"><input className={inputCls} value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))} /></Field>
          <Field label="Potencial comercial">
            <select className={inputCls} value={form.potencial_comercial} onChange={e => setForm(f => ({ ...f, potencial_comercial: e.target.value }))}>
              {POTENCIALES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className={inputCls} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Responsable comercial"><input className={inputCls} value={form.responsable_comercial} onChange={e => setForm(f => ({ ...f, responsable_comercial: e.target.value }))} /></Field>
          <div className="col-span-2">
            <Field label="Observaciones"><textarea className={inputCls} rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} /></Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit">Crear cliente</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
