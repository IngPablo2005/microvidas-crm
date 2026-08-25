import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState } from '../../components/UI.jsx';
import { Plus, Download, Upload, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const ESTADOS = ['Activo', 'Inactivo', 'Perdido'];
const POTENCIALES = ['Alto', 'Medio', 'Bajo'];
const PAGE_SIZE = 50;

const emptyClient = {
  razon_social: '', nombre_comercial: '', cuit: '', contacto_principal: '', cargo: '', telefono: '', whatsapp: '',
  email: '', provincia: '', localidad: '', direccion: '', tipo_cliente: '', segmento: '', estado: 'Activo',
  potencial_comercial: 'Medio', responsable_comercial: '', observaciones: '',
};

export default function ClientsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', estado: '', provincia: '' });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const [provincias, setProvincias] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function load() {
    setLoading(true);
    const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, pageSize: PAGE_SIZE };
    const { data } = await api.get('/clients', { params });
    setRows(data.rows);
    setTotal(data.total);
    setLoading(false);
  }

  // La lista de provincias para el filtro sale de TODOS los clientes (no solo los de
  // la página actual), para que no "desaparezcan" opciones al paginar.
  useEffect(() => { api.get('/clients/filtros/provincias').then(({ data }) => setProvincias(data)); }, []);

  useEffect(() => { load(); }, [filters, page]);

  // Si la página actual quedó fuera de rango (por ejemplo, se borró el único cliente
  // de la última página), volvemos a una página válida.
  useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
  }, [loading, totalPages]);

  // Cambiar un filtro siempre vuelve a la página 1 (en el mismo evento, para no
  // disparar una carga de más con la página vieja antes de resetearla).
  function updateFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }

  async function createClient(e) {
    e.preventDefault();
    const { data } = await api.post('/clients', form);
    setShowNew(false);
    setForm(emptyClient);
    navigate(`/clientes/${data.id}`);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/clients/${toDelete.id}`);
      setToDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-500">{total} cliente{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/importar')}><Upload size={14} className="inline mr-1" /> Importar</Button>
          <Button variant="secondary" onClick={() => window.open('/api/export/clients?format=xlsx', '_blank')}><Download size={14} className="inline mr-1" /> Exportar</Button>
          <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Nuevo cliente</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className={inputCls} placeholder="Buscar por razón social, CUIT, contacto..." value={filters.q} onChange={e => updateFilter('q', e.target.value)} />
          <select className={inputCls} value={filters.estado} onChange={e => updateFilter('estado', e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputCls} value={filters.provincia} onChange={e => updateFilter('provincia', e.target.value)}>
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
                <th className="text-right px-4 py-2.5"></th>
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
                  <td className="px-4 py-2.5 text-right">
                    <button
                      title="Eliminar cliente"
                      onClick={e => { e.stopPropagation(); setToDelete(c); }}
                      className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft size={14} className="inline" /> Anterior
            </Button>
            <span className="text-gray-600">Página {page} de {totalPages}</span>
            <Button variant="secondary" className="disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Siguiente <ChevronRight size={14} className="inline" />
            </Button>
          </div>
        </div>
      )}

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

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar cliente">
        <p className="text-sm text-gray-600">
          ¿Seguro que querés eliminar a <span className="font-semibold text-gray-800">{toDelete?.razon_social}</span>?
          Esta acción también borra sus ventas, cotizaciones, cobranzas, tareas, notas y todo lo relacionado. No se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" type="button" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="danger" type="button" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
