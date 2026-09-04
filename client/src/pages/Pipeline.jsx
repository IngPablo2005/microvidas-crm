import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { Card, Button, Modal, Field, inputCls, Loading, fmtUSD } from '../components/UI.jsx';
import ClientPicker from '../components/ClientPicker.jsx';
import DateInput from '../components/DateInput.jsx';
import { CATEGORICAL } from '../colors.js';
import { Plus, Pencil } from 'lucide-react';

const STAGES = ['Prospecto', 'Contactado', 'Reunion', 'Cotizacion', 'Negociacion', 'Ganada', 'Perdida'];
const LABELS = { Prospecto: 'Prospecto', Contactado: 'Contactado', Reunion: 'Reunión', Cotizacion: 'Cotización', Negociacion: 'Negociación', Ganada: 'Ganada', Perdida: 'Perdida' };
const empty = { titulo: '', client_id: '', importe_estimado: '', probabilidad: 20, responsable: '', proxima_accion: '', fecha_cierre_estimada: '', etapa: 'Prospecto' };

export default function Pipeline() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);

  // Se usa tanto en el load() general como cada vez que se abre el buscador de
  // clientes del formulario, así un cliente recién cargado en otra pestaña
  // aparece sin recargar toda la página.
  function refreshClients() {
    return api.get('/clients', { params: { pageSize: 200 } }).then(({ data }) => setClients(data.rows));
  }

  async function load() {
    setLoading(true);
    const [p] = await Promise.all([api.get('/pipeline'), refreshClients()]);
    setRows(p.data.rows);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function moveStage(id, etapa) {
    await api.patch(`/pipeline/${id}/stage`, { etapa });
    load();
  }

  function openCreate() {
    setForm(empty);
    setEditingId(null);
    setShowNew(true);
  }

  function openEdit(op) {
    setForm({
      titulo: op.titulo, client_id: op.client_id || '', importe_estimado: op.importe_estimado ?? '',
      probabilidad: op.probabilidad ?? 20, responsable: op.responsable || '', proxima_accion: op.proxima_accion || '',
      fecha_cierre_estimada: op.fecha_cierre_estimada || '', etapa: op.etapa,
    });
    setEditingId(op.id);
    setShowNew(true);
  }

  async function save(e) {
    e.preventDefault();
    if (editingId) {
      await api.put(`/pipeline/${editingId}`, form);
    } else {
      await api.post('/pipeline', form);
    }
    setShowNew(false);
    setEditingId(null);
    setForm(empty);
    load();
  }

  if (loading) return <Loading />;

  // % que representa cada etapa sobre el total de oportunidades cargadas (para ver de
  // un vistazo dónde se concentra el pipeline), no confundir con una tasa de conversión
  // etapa a etapa — eso requeriría seguir el historial de cada oportunidad en el tiempo.
  const totalOportunidades = rows.length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Pipeline comercial</h1>
          <p className="text-sm text-gray-500">{rows.length} oportunidades</p>
        </div>
        <Button onClick={openCreate}><Plus size={14} className="inline mr-1" /> Nueva oportunidad</Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage, i) => {
          const items = rows.filter(r => r.etapa === stage);
          const total = items.reduce((s, r) => s + (r.importe_estimado || 0), 0);
          const pct = totalOportunidades ? Math.round((items.length / totalOportunidades) * 100) : 0;
          return (
            <div key={stage} className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORICAL[i % CATEGORICAL.length] }} />
                <span className="text-xs font-semibold text-gray-600">{LABELS[stage]}</span>
                <span className="text-xs text-gray-400">({items.length} · {pct}%)</span>
              </div>
              <div className="text-xs text-gray-400 mb-2">{fmtUSD(total)}</div>
              <div className="space-y-2">
                {items.map(op => (
                  <Card key={op.id} className="p-3">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-sm font-medium text-gray-800">{op.titulo}</div>
                      <button title="Editar" onClick={() => openEdit(op)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 shrink-0">
                        <Pencil size={13} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">{op.cliente_nombre || op.prospecto_nombre}</div>
                    <div className="text-xs text-gray-500 mt-1">{fmtUSD(op.importe_estimado)} · {op.probabilidad}%</div>
                    {op.proxima_accion && <div className="text-xs text-gray-400 mt-1">Próx: {op.proxima_accion}</div>}
                    <select
                      value={op.etapa}
                      onChange={e => moveStage(op.id, e.target.value)}
                      className="mt-2 w-full text-xs border border-gray-200 rounded px-1.5 py-1"
                    >
                      {STAGES.map(s => <option key={s} value={s}>{LABELS[s]}</option>)}
                    </select>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title={editingId ? 'Editar oportunidad' : 'Nueva oportunidad'}>
        <form onSubmit={save}>
          <Field label="Título *"><input required className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></Field>
          <Field label="Cliente">
            <ClientPicker clients={clients} value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))} onOpen={refreshClients} placeholder="Sin cliente asociado (opcional)..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importe estimado (USD)"><input type="number" className={inputCls} value={form.importe_estimado} onChange={e => setForm(f => ({ ...f, importe_estimado: e.target.value }))} /></Field>
            <Field label="Probabilidad (%)"><input type="number" min="0" max="100" className={inputCls} value={form.probabilidad} onChange={e => setForm(f => ({ ...f, probabilidad: e.target.value }))} /></Field>
          </div>
          <Field label="Etapa">
            <select className={inputCls} value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
              {STAGES.map(s => <option key={s} value={s}>{LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></Field>
          <Field label="Próxima acción"><input className={inputCls} value={form.proxima_accion} onChange={e => setForm(f => ({ ...f, proxima_accion: e.target.value }))} /></Field>
          <Field label="Fecha de cierre estimada"><DateInput className={inputCls} value={form.fecha_cierre_estimada} onChange={v => setForm(f => ({ ...f, fecha_cierre_estimada: v }))} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit">{editingId ? 'Guardar cambios' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
