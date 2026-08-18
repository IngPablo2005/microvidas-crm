import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtUSD, fmtDate } from '../components/UI.jsx';
import { Plus, ArrowRightCircle } from 'lucide-react';

const ESTADOS = ['Nuevo', 'Contactado', 'Calificado', 'Cotizacion', 'Negociacion', 'Ganado', 'Perdido'];
const empty = { empresa: '', contacto: '', telefono: '', email: '', localidad: '', provincia: '', origen: '', potencial_estimado: '', interes: '', responsable: '', proximo_contacto: '', probabilidad: 20, estado: 'Nuevo' };

export default function Prospects() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/prospects', { params: estado ? { estado } : {} });
    setRows(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, [estado]);

  async function create(e) {
    e.preventDefault();
    await api.post('/prospects', form);
    setShowNew(false);
    setForm(empty);
    load();
  }

  async function convert(id) {
    if (!window.confirm('¿Convertir este prospecto en cliente? Se conservará todo su historial.')) return;
    const { data } = await api.post(`/prospects/${id}/convert`);
    navigate(`/clientes/${data.clientId}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Prospectos</h1>
          <p className="text-sm text-gray-500">{rows.length} prospectos</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Nuevo prospecto</Button>
      </div>

      <Card className="p-4">
        <select className={inputCls + ' max-w-xs'} value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Card>

      <Card className="overflow-x-auto">
        {loading ? <Loading /> : rows.length === 0 ? <EmptyState text="No hay prospectos." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Empresa</th>
                <th className="text-left px-4 py-2.5">Contacto</th>
                <th className="text-left px-4 py-2.5">Interés</th>
                <th className="text-left px-4 py-2.5">Potencial</th>
                <th className="text-left px-4 py-2.5">Probabilidad</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Próximo contacto</th>
                <th className="text-left px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{p.empresa}<div className="text-xs text-gray-400">{p.localidad}, {p.provincia}</div></td>
                  <td className="px-4 py-2.5 text-gray-600">{p.contacto}<div className="text-xs text-gray-400">{p.telefono}</div></td>
                  <td className="px-4 py-2.5 text-gray-600">{p.interes}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtUSD(p.potencial_estimado)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{p.probabilidad}%</td>
                  <td className="px-4 py-2.5"><Badge text={p.estado} /></td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(p.proximo_contacto)}</td>
                  <td className="px-4 py-2.5">
                    {p.estado !== 'Ganado' && p.estado !== 'Perdido' && (
                      <button onClick={() => convert(p.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <ArrowRightCircle size={13} /> Convertir en cliente
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo prospecto" width="max-w-2xl">
        <form onSubmit={create} className="grid grid-cols-2 gap-x-4">
          <Field label="Empresa *"><input required className={inputCls} value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} /></Field>
          <Field label="Contacto"><input className={inputCls} value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} /></Field>
          <Field label="Teléfono"><input className={inputCls} value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Localidad"><input className={inputCls} value={form.localidad} onChange={e => setForm(f => ({ ...f, localidad: e.target.value }))} /></Field>
          <Field label="Provincia"><input className={inputCls} value={form.provincia} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} /></Field>
          <Field label="Origen"><input className={inputCls} value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))} placeholder="Feria, referido, web..." /></Field>
          <Field label="Potencial estimado (USD)"><input type="number" className={inputCls} value={form.potencial_estimado} onChange={e => setForm(f => ({ ...f, potencial_estimado: e.target.value }))} /></Field>
          <Field label="Producto / interés"><input className={inputCls} value={form.interes} onChange={e => setForm(f => ({ ...f, interes: e.target.value }))} /></Field>
          <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></Field>
          <Field label="Próximo contacto"><input type="date" className={inputCls} value={form.proximo_contacto} onChange={e => setForm(f => ({ ...f, proximo_contacto: e.target.value }))} /></Field>
          <Field label="Probabilidad (%)"><input type="number" min="0" max="100" className={inputCls} value={form.probabilidad} onChange={e => setForm(f => ({ ...f, probabilidad: e.target.value }))} /></Field>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit">Crear prospecto</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
