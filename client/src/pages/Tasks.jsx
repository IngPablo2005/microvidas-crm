import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtDate } from '../components/UI.jsx';
import { Plus } from 'lucide-react';

const ESTADOS = ['Pendiente', 'En proceso', 'Completada', 'Vencida'];
const empty = { titulo: '', client_id: '', fecha: new Date().toISOString().slice(0, 10), hora: '', prioridad: 'Media', responsable: '', descripcion: '', estado: 'Pendiente' };

export default function Tasks() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const [t, c] = await Promise.all([
      api.get('/tasks', { params: estado ? { estado } : {} }),
      api.get('/clients', { params: { pageSize: 200 } }),
    ]);
    setRows(t.data);
    setClients(c.data.rows);
    setLoading(false);
  }
  useEffect(() => { load(); }, [estado]);

  async function complete(id) { await api.patch(`/tasks/${id}/complete`); load(); }

  async function create(e) {
    e.preventDefault();
    await api.post('/tasks', { ...form, client_id: form.client_id || null, usuario: 'Usuario' });
    setShowNew(false);
    setForm(empty);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Tareas</h1>
          <p className="text-sm text-gray-500">{rows.length} tareas</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Nueva tarea</Button>
      </div>

      <Card className="p-4">
        <select className={inputCls + ' max-w-xs'} value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Card>

      <Card className="overflow-x-auto">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState text="No hay tareas." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 w-8"></th>
                <th className="text-left px-4 py-2.5">Título</th>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Prioridad</th>
                <th className="text-left px-4 py-2.5">Responsable</th>
                <th className="text-left px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-4 py-2.5"><input type="checkbox" checked={t.estado === 'Completada'} onChange={() => complete(t.id)} /></td>
                  <td className={`px-4 py-2.5 font-medium ${t.estado === 'Completada' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.titulo}<div className="text-xs text-gray-400">{t.descripcion}</div></td>
                  <td className="px-4 py-2.5 text-gray-600">{t.cliente_nombre || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(t.fecha)} {t.hora}</td>
                  <td className="px-4 py-2.5"><Badge text={t.prioridad} colorKey={t.prioridad === 'Alta' ? 'Vencida' : t.prioridad === 'Media' ? 'Contactado' : 'Inactivo'} /></td>
                  <td className="px-4 py-2.5 text-gray-600">{t.responsable}</td>
                  <td className="px-4 py-2.5"><Badge text={t.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva tarea">
        <form onSubmit={create}>
          <Field label="Título *"><input required className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></Field>
          <Field label="Cliente">
            <select className={inputCls} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">— Sin cliente —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></Field>
            <Field label="Hora"><input type="time" className={inputCls} value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridad">
              <select className={inputCls} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                <option>Alta</option><option>Media</option><option>Baja</option>
              </select>
            </Field>
            <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></Field>
          </div>
          <Field label="Descripción"><textarea className={inputCls} rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit">Crear tarea</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
