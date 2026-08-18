import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { Card, Button, Modal, Field, inputCls, Loading } from '../components/UI.jsx';
import { CATEGORICAL } from '../colors.js';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const TIPOS = ['Llamada', 'Reunion', 'Visita', 'WhatsApp', 'Email', 'Seguimiento', 'Cotizacion', 'Cobranza', 'Tarea', 'Otro'];
const TIPO_COLOR = Object.fromEntries(TIPOS.map((t, i) => [t, CATEGORICAL[i % CATEGORICAL.length]]));
const empty = { titulo: '', client_id: '', fecha: new Date().toISOString().slice(0, 10), hora: '10:00', tipo: 'Reunion', descripcion: '', prioridad: 'Media', recordatorio: '1 dia antes', repeticion: 'Ninguna' };

function toISO(d) { return d.toISOString().slice(0, 10); }
function startOfWeek(d) { const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); return dt; }

export default function CalendarPage() {
  const [view, setView] = useState('mes');
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(empty);

  const rangeStart = view === 'mes' ? new Date(cursor.getFullYear(), cursor.getMonth(), 1) : view === 'semana' ? startOfWeek(cursor) : cursor;
  const rangeEnd = view === 'mes' ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) : view === 'semana' ? new Date(startOfWeek(cursor).getTime() + 6 * 86400000) : cursor;

  async function load() {
    setLoading(true);
    const [e, c] = await Promise.all([
      api.get('/calendar', { params: { desde: toISO(new Date(rangeStart.getTime() - 7 * 86400000)), hasta: toISO(new Date(rangeEnd.getTime() + 7 * 86400000)) } }),
      api.get('/clients', { params: { pageSize: 200 } }),
    ]);
    setEvents(e.data);
    setClients(c.data.rows);
    setLoading(false);
  }
  useEffect(() => { load(); }, [view, cursor]);

  async function create(e) {
    e.preventDefault();
    await api.post('/calendar', { ...form, client_id: form.client_id || null, usuario: 'Usuario' });
    setShowNew(false);
    setForm(empty);
    load();
  }

  function shift(delta) {
    const d = new Date(cursor);
    if (view === 'mes') d.setMonth(d.getMonth() + delta);
    else if (view === 'semana') d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  }

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400000));
  const eventsByDay = {};
  for (const ev of events) { (eventsByDay[ev.fecha] ||= []).push(ev); }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Calendario comercial</h1>
          <p className="text-sm text-gray-500">{cursor.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            {['dia', 'semana', 'mes'].map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium capitalize ${view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => shift(-1)} className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50"><ChevronLeft size={14} /></button>
          <button onClick={() => setCursor(new Date())} className="px-2 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50">Hoy</button>
          <button onClick={() => shift(1)} className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50"><ChevronRight size={14} /></button>
          <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Nuevo evento</Button>
        </div>
      </div>

      {view === 'mes' && (
        <Card className="p-3">
          <div className="grid grid-cols-7 text-xs font-medium text-gray-400 mb-1">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const iso = toISO(d);
              const isCurMonth = d.getMonth() === cursor.getMonth();
              const isToday = iso === toISO(new Date());
              const dayEvents = eventsByDay[iso] || [];
              return (
                <div key={i} className={`min-h-24 rounded-md border p-1.5 ${isCurMonth ? 'border-gray-100' : 'border-gray-50 bg-gray-50/50'}`}>
                  <div className={`text-xs mb-1 ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white' : isCurMonth ? 'text-gray-600' : 'text-gray-300'}`}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className="text-[10px] px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: TIPO_COLOR[ev.tipo] || '#898781' }} title={ev.titulo}>
                        {ev.hora ? ev.hora + ' ' : ''}{ev.titulo}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[10px] text-gray-400">+{dayEvents.length - 3} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === 'semana' && (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => new Date(startOfWeek(cursor).getTime() + i * 86400000)).map(d => {
            const iso = toISO(d);
            const dayEvents = (eventsByDay[iso] || []).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
            return (
              <Card key={iso} className="p-2 min-h-40">
                <div className="text-xs font-medium text-gray-600 mb-2">{d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}</div>
                <div className="space-y-1">
                  {dayEvents.map(ev => (
                    <div key={ev.id} className="text-[11px] px-1.5 py-1 rounded text-white" style={{ backgroundColor: TIPO_COLOR[ev.tipo] || '#898781' }}>
                      {ev.hora} {ev.titulo}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {view === 'dia' && (
        <Card className="p-4">
          <div className="font-medium text-gray-700 mb-3">{cursor.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="space-y-2">
            {(eventsByDay[toISO(cursor)] || []).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')).map(ev => (
              <div key={ev.id} className="flex gap-3 items-start border border-gray-100 rounded-md p-3">
                <span className="text-xs font-medium text-gray-500 w-14">{ev.hora || '—'}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{ev.titulo}</div>
                  <div className="text-xs text-gray-400">{ev.tipo} {ev.cliente_nombre ? `· ${ev.cliente_nombre}` : ''}</div>
                  {ev.descripcion && <div className="text-xs text-gray-500 mt-1">{ev.descripcion}</div>}
                </div>
              </div>
            ))}
            {(eventsByDay[toISO(cursor)] || []).length === 0 && <div className="text-sm text-gray-400">Sin eventos para este día.</div>}
          </div>
        </Card>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo evento">
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
            <Field label="Tipo de actividad">
              <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select className={inputCls} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                <option>Alta</option><option>Media</option><option>Baja</option>
              </select>
            </Field>
          </div>
          <Field label="Recordatorio">
            <select className={inputCls} value={form.recordatorio} onChange={e => setForm(f => ({ ...f, recordatorio: e.target.value }))}>
              {['5 minutos antes', '15 minutos antes', '30 minutos antes', '1 hora antes', '1 dia antes', 'Personalizado'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Descripción"><textarea className={inputCls} rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit">Crear evento</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
