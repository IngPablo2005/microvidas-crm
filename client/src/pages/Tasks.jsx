import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtDate } from '../components/UI.jsx';
import ClientPicker from '../components/ClientPicker.jsx';
import DateInput from '../components/DateInput.jsx';
import { Plus, Pencil, Trash2, Clock, AlertTriangle } from 'lucide-react';

const ESTADOS = ['Pendiente', 'En proceso', 'Completada', 'Vencida'];
const empty = { titulo: '', client_id: '', fecha: new Date().toISOString().slice(0, 10), hora: '', prioridad: 'Media', responsable: '', descripcion: '', estado: 'Pendiente' };

// Una tarea está vencida si ya pasó su fecha y no está completada, sin importar lo
// que diga el campo "estado" (que no se actualiza solo) — es el mismo criterio que
// usa el Dashboard para el aviso de "Tareas vencidas".
function estaVencida(t) {
  return t.estado !== 'Completada' && t.fecha < new Date().toISOString().slice(0, 10);
}

function addDays(fechaISO, n) {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function PostponeModal({ task, onClose, onSaved }) {
  const [fecha, setFecha] = useState(task.fecha);
  const [saving, setSaving] = useState(false);

  async function apply(nuevaFecha) {
    if (!nuevaFecha) return;
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, {
        titulo: task.titulo, client_id: task.client_id || null, fecha: nuevaFecha, hora: task.hora,
        prioridad: task.prioridad, responsable: task.responsable, descripcion: task.descripcion,
        // Si estaba vencida, al posponerla deja de estarlo.
        estado: task.estado === 'Vencida' ? 'Pendiente' : task.estado,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Posponer tarea">
      <p className="text-sm text-gray-600 mb-3">
        <span className="font-medium text-gray-800">{task.titulo}</span>
        <br />Fecha actual: {fmtDate(task.fecha)}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="secondary" disabled={saving} onClick={() => apply(addDays(task.fecha, 1))}>+1 día</Button>
        <Button variant="secondary" disabled={saving} onClick={() => apply(addDays(task.fecha, 3))}>+3 días</Button>
        <Button variant="secondary" disabled={saving} onClick={() => apply(addDays(task.fecha, 7))}>+7 días</Button>
      </div>
      <Field label="O elegir una fecha puntual">
        <DateInput className={inputCls} value={fecha} onChange={v => setFecha(v)} />
      </Field>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="button" onClick={() => apply(fecha)} disabled={saving}>{saving ? 'Guardando...' : 'Posponer a esta fecha'}</Button>
      </div>
    </Modal>
  );
}

export default function Tasks() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);
  const [postponing, setPostponing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Se usa tanto en el load() general como cada vez que se abre el buscador de
  // clientes del formulario, así un cliente recién cargado en otra pestaña
  // aparece sin recargar toda la página.
  function refreshClients() {
    return api.get('/clients', { params: { pageSize: 200 } }).then(({ data }) => setClients(data.rows));
  }

  async function load() {
    setLoading(true);
    const [t] = await Promise.all([
      api.get('/tasks', { params: estado ? { estado } : {} }),
      refreshClients(),
    ]);
    setRows(t.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, [estado]);

  async function complete(id) { await api.patch(`/tasks/${id}/complete`); load(); }

  function openCreate() {
    setForm(empty);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(t) {
    setForm({
      titulo: t.titulo, client_id: t.client_id || '', fecha: t.fecha, hora: t.hora || '',
      prioridad: t.prioridad, responsable: t.responsable || '', descripcion: t.descripcion || '', estado: t.estado,
    });
    setEditingId(t.id);
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = { ...form, client_id: form.client_id || null, usuario: 'Usuario' };
    if (editingId) {
      await api.put(`/tasks/${editingId}`, payload);
    } else {
      await api.post('/tasks', payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(empty);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${toDelete.id}`);
      setToDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Tareas</h1>
          <p className="text-sm text-gray-500">{rows.length} tareas</p>
        </div>
        <Button onClick={openCreate}><Plus size={14} className="inline mr-1" /> Nueva tarea</Button>
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
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => {
                const vencida = estaVencida(t);
                return (
                <tr key={t.id} className={`border-t border-gray-100 hover:bg-red-50/60 ${vencida ? 'bg-red-50 border-l-4 border-l-red-400' : 'hover:bg-blue-50'}`}>
                  <td className="px-4 py-2.5"><input type="checkbox" checked={t.estado === 'Completada'} onChange={() => complete(t.id)} /></td>
                  <td className={`px-4 py-2.5 font-medium ${t.estado === 'Completada' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    <div className="flex items-center gap-1.5">
                      {vencida && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                      <span className={vencida ? 'text-red-700 font-semibold' : ''}>{t.titulo}</span>
                    </div>
                    <div className="text-xs text-gray-400">{t.descripcion}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{t.cliente_nombre || '—'}</td>
                  <td className={`px-4 py-2.5 ${vencida ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{fmtDate(t.fecha)} {t.hora}</td>
                  <td className="px-4 py-2.5"><Badge text={t.prioridad} colorKey={t.prioridad === 'Alta' ? 'Vencida' : t.prioridad === 'Media' ? 'Contactado' : 'Inactivo'} /></td>
                  <td className="px-4 py-2.5 text-gray-600">{t.responsable}</td>
                  <td className="px-4 py-2.5">
                    {vencida ? <Badge text="Vencida" colorKey="Vencida" /> : <Badge text={t.estado} />}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button title="Posponer" onClick={() => setPostponing(t)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50">
                        <Clock size={15} />
                      </button>
                      <button title="Editar" onClick={() => openEdit(t)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50">
                        <Pencil size={15} />
                      </button>
                      <button title="Eliminar" onClick={() => setToDelete(t)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar tarea' : 'Nueva tarea'}>
        <form onSubmit={save}>
          <Field label="Título *"><input required className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></Field>
          <Field label="Cliente">
            <ClientPicker clients={clients} value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))} onOpen={refreshClients} placeholder="Sin cliente (opcional)..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha"><DateInput className={inputCls} value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} /></Field>
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
          {editingId && (
            <Field label="Estado">
              <select className={inputCls} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <Field label="Descripción"><textarea className={inputCls} rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit">{editingId ? 'Guardar cambios' : 'Crear tarea'}</Button>
          </div>
        </form>
      </Modal>

      {postponing && (
        <PostponeModal task={postponing} onClose={() => setPostponing(null)} onSaved={() => { setPostponing(null); load(); }} />
      )}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar tarea">
        <p className="text-sm text-gray-600">
          ¿Seguro que querés eliminar la tarea <span className="font-semibold text-gray-800">{toDelete?.titulo}</span>? No se puede deshacer.
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
