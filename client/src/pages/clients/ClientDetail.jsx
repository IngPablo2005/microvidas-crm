import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtUSD, fmtDate } from '../../components/UI.jsx';
import {
  StickyNote, CheckSquare, FileText, ShoppingCart, Award, Image as ImageIcon, CalendarPlus, Phone, Mail,
  MessageCircle, Users as UsersIcon, ArrowLeft, Trash2, Pencil
} from 'lucide-react';

const ESTADOS_CLIENTE = ['Activo', 'Inactivo', 'Perdido'];
const POTENCIALES_CLIENTE = ['Alto', 'Medio', 'Bajo'];

const TABS = ['Resumen', 'Historial', 'Hitos', 'Contactos', 'Cobranzas', 'Documentos'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState('Resumen');
  const [timeline, setTimeline] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [account, setAccount] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, tl, ms, att, acc] = await Promise.all([
      api.get(`/clients/${id}`),
      api.get(`/clients/${id}/timeline`),
      api.get(`/clients/${id}/milestones`),
      api.get(`/clients/${id}/attachments`),
      api.get(`/collections/account/${id}`),
    ]);
    setClient(c.data);
    setTimeline(tl.data);
    setMilestones(ms.data);
    setAttachments(att.data);
    setAccount(acc.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function deleteClient() {
    setDeleting(true);
    try {
      await api.delete(`/clients/${id}`);
      navigate('/clientes');
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !client) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/clientes')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft size={14} /> Volver a clientes
        </button>
        <div className="flex items-center gap-4">
          <button onClick={() => setModal('editar')} className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1">
            <Pencil size={14} /> Editar cliente
          </button>
          <button onClick={() => setModal('eliminar')} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
            <Trash2 size={14} /> Eliminar cliente
          </button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-800">{client.razon_social}</h1>
              <Badge text={client.estado} />
              {client.potencial_comercial && <Badge text={`Potencial: ${client.potencial_comercial}`} colorKey={client.potencial_comercial === 'Alto' ? 'Activo' : client.potencial_comercial === 'Bajo' ? 'Perdido' : 'Contactado'} />}
            </div>
            <div className="text-sm text-gray-500 mt-1">{client.nombre_comercial} · CUIT {client.cuit || '—'} · {client.localidad}, {client.provincia}</div>
            <div className="flex gap-4 mt-2 text-sm text-gray-600">
              {client.contacto_principal && <span className="flex items-center gap-1"><UsersIcon size={13} /> {client.contacto_principal} ({client.cargo})</span>}
              {client.telefono && <span className="flex items-center gap-1"><Phone size={13} /> {client.telefono}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail size={13} /> {client.email}</span>}
              {client.whatsapp && <span className="flex items-center gap-1"><MessageCircle size={13} /> {client.whatsapp}</span>}
            </div>
            <div className="text-xs text-gray-400 mt-2">Responsable: {client.responsable_comercial || '—'} · Último contacto: {fmtDate(client.ultimo_contacto)} · Próximo: {fmtDate(client.proximo_contacto)}</div>
            {client.observaciones && <div className="text-sm text-gray-500 mt-2 italic">"{client.observaciones}"</div>}
          </div>
          <div className="flex flex-wrap gap-2 max-w-xs justify-end">
            <QuickAction icon={StickyNote} label="Agregar nota" onClick={() => setModal('nota')} />
            <QuickAction icon={CheckSquare} label="Crear tarea" onClick={() => setModal('tarea')} />
            <QuickAction icon={FileText} label="Nueva cotización" onClick={() => navigate(`/cotizaciones?client_id=${id}`)} />
            <QuickAction icon={ShoppingCart} label="Registrar venta" onClick={() => navigate(`/ventas?client_id=${id}`)} />
            <QuickAction icon={Award} label="Agregar hito" onClick={() => setModal('hito')} />
            <QuickAction icon={ImageIcon} label="Subir archivo" onClick={() => setModal('archivo')} />
            <QuickAction icon={CalendarPlus} label="Programar reunión" onClick={() => setModal('reunion')} />
          </div>
        </div>
      </Card>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Resumen' && <ResumenTab client={client} account={account} milestones={milestones} />}
      {tab === 'Historial' && <HistorialTab timeline={timeline} />}
      {tab === 'Hitos' && <HitosTab milestones={milestones} />}
      {tab === 'Contactos' && <ContactosTab client={client} onChange={load} />}
      {tab === 'Cobranzas' && <CobranzasTab account={account} clientId={id} onChange={load} />}
      {tab === 'Documentos' && <DocumentosTab attachments={attachments} clientId={id} onChange={load} />}

      {modal === 'nota' && <NoteModal clientId={id} onClose={() => setModal(null)} onSaved={load} />}
      {modal === 'tarea' && <TaskModal clientId={id} onClose={() => setModal(null)} onSaved={load} />}
      {modal === 'hito' && <MilestoneModal clientId={id} onClose={() => setModal(null)} onSaved={load} />}
      {modal === 'archivo' && <FileModal clientId={id} onClose={() => setModal(null)} onSaved={load} />}
      {modal === 'reunion' && <MeetingModal clientId={id} onClose={() => setModal(null)} onSaved={load} />}
      {modal === 'editar' && <EditClientModal client={client} onClose={() => setModal(null)} onSaved={load} />}

      <Modal open={modal === 'eliminar'} onClose={() => setModal(null)} title="Eliminar cliente">
        <p className="text-sm text-gray-600">
          ¿Seguro que querés eliminar a <span className="font-semibold text-gray-800">{client.razon_social}</span>?
          Esta acción también borra sus ventas, cotizaciones, cobranzas, tareas, notas y todo lo relacionado. No se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancelar</Button>
          <Button variant="danger" type="button" onClick={deleteClient} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300">
      <Icon size={13} /> {label}
    </button>
  );
}

function ResumenTab({ client, account, milestones }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="p-4">
        <div className="text-xs text-gray-400 uppercase font-medium">Cuenta corriente</div>
        <div className="text-2xl font-semibold mt-1">{fmtUSD(account?.saldo)}</div>
        <Badge text={account?.estadoSaldo || '—'} colorKey={account?.estadoSaldo === 'Deuda vencida' ? 'Vencida' : account?.estadoSaldo === 'Al día' ? 'Activo' : 'Contactado'} />
      </Card>
      <Card className="p-4">
        <div className="text-xs text-gray-400 uppercase font-medium">Total histórico cobrado</div>
        <div className="text-2xl font-semibold mt-1">{fmtUSD(account?.totalCobrado)}</div>
        <div className="text-xs text-gray-400 mt-1">Última cobranza: {fmtDate(account?.ultimaCobranza?.fecha)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-gray-400 uppercase font-medium">Deuda vencida</div>
        <div className="text-2xl font-semibold mt-1" style={{ color: account?.totalVencido > 0 ? '#d03b3b' : undefined }}>{fmtUSD(account?.totalVencido)}</div>
        <div className="text-xs text-gray-400 mt-1">Días promedio de atraso: {account?.diasPromedioAtraso ?? 0}</div>
      </Card>
      <Card className="p-4 md:col-span-3">
        <div className="text-sm font-semibold text-gray-700 mb-2">Últimos hitos</div>
        {milestones.length === 0 ? <EmptyState text="Sin hitos registrados." /> : (
          <ul className="space-y-1.5">
            {milestones.slice(0, 5).map(m => (
              <li key={m.id} className="text-sm text-gray-600 flex justify-between border-b border-gray-50 pb-1.5">
                <span><span className="font-medium text-gray-700">{m.tipo}</span> — {m.descripcion}</span>
                <span className="text-gray-400">{fmtDate(m.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HistorialTab({ timeline }) {
  if (!timeline.length) return <EmptyState text="Sin actividad registrada." />;
  return (
    <Card className="p-5">
      <div className="space-y-3">
        {timeline.map((e, i) => (
          <div key={i} className="flex gap-3 border-l-2 border-blue-100 pl-3 pb-3 relative">
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-400" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-medium text-gray-600">{e.tipo}</span>
                <span>· {new Date(e.fecha).toLocaleString('es-AR')}</span>
                {e.usuario && <span>· {e.usuario}</span>}
              </div>
              <div className="text-sm text-gray-700">{e.descripcion}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HitosTab({ milestones }) {
  if (!milestones.length) return <EmptyState text="Sin hitos registrados." />;
  return (
    <Card className="p-5">
      <div className="space-y-3">
        {milestones.map(m => (
          <div key={m.id} className="flex justify-between border-b border-gray-100 pb-2">
            <div>
              <div className="font-medium text-sm text-gray-800">{m.tipo}</div>
              <div className="text-sm text-gray-500">{m.descripcion}</div>
            </div>
            <div className="text-xs text-gray-400">{fmtDate(m.fecha)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ContactosTab({ client, onChange }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ nombre: '', cargo: '', telefono: '', whatsapp: '', email: '', principal: false });

  async function addContact(e) {
    e.preventDefault();
    await api.post(`/clients/${client.id}/contacts`, form);
    setShowNew(false);
    setForm({ nombre: '', cargo: '', telefono: '', whatsapp: '', email: '', principal: false });
    onChange();
  }
  async function removeContact(cid) {
    await api.delete(`/clients/contacts/${cid}`);
    onChange();
  }

  return (
    <Card className="p-5">
      <div className="flex justify-between mb-3">
        <div className="text-sm font-semibold text-gray-700">Contactos</div>
        <Button onClick={() => setShowNew(true)}>+ Agregar contacto</Button>
      </div>
      {client.contacts?.length === 0 ? <EmptyState text="Sin contactos adicionales." /> : (
        <div className="space-y-2">
          {client.contacts?.map(c => (
            <div key={c.id} className="flex justify-between items-center border border-gray-100 rounded-md p-2.5">
              <div>
                <div className="text-sm font-medium text-gray-800">{c.nombre} {c.principal ? <Badge text="Principal" colorKey="Activo" /> : null}</div>
                <div className="text-xs text-gray-500">{c.cargo} · {c.telefono} · {c.email}</div>
              </div>
              {!c.principal && <button onClick={() => removeContact(c.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo contacto">
        <form onSubmit={addContact}>
          <Field label="Nombre *"><input required className={inputCls} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></Field>
          <Field label="Cargo"><input className={inputCls} value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} /></Field>
          <Field label="Teléfono"><input className={inputCls} value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function CobranzasTab({ account, clientId, onChange }) {
  const [showNew, setShowNew] = useState(false);
  if (!account) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-xs text-gray-400">Total facturado</div><div className="font-semibold">{fmtUSD(account.totalFacturado)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-400">Total cobrado</div><div className="font-semibold">{fmtUSD(account.totalCobrado)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-400">Pendiente</div><div className="font-semibold">{fmtUSD(account.totalPendiente)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-400">Vencido</div><div className="font-semibold text-red-600">{fmtUSD(account.totalVencido)}</div></Card>
      </div>
      <Card className="p-5">
        <div className="flex justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700">Cuenta corriente</div>
          <Button onClick={() => setShowNew(true)}>+ Registrar cobranza</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-400 uppercase">
            <tr><th className="text-left py-1.5">Fecha</th><th className="text-left py-1.5">Tipo</th><th className="text-left py-1.5">Comprobante</th><th className="text-right py-1.5">Importe</th><th className="text-left py-1.5">Estado</th></tr>
          </thead>
          <tbody>
            {account.movimientos.map((m, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="py-1.5">{fmtDate(m.fecha)}</td>
                <td className="py-1.5">{m.tipo}</td>
                <td className="py-1.5">{m.comprobante}</td>
                <td className={`py-1.5 text-right ${m.importe < 0 ? 'text-green-600' : ''}`}>{fmtUSD(m.importe)}</td>
                <td className="py-1.5">{m.estado && <Badge text={m.estado} />}{m.medio_pago}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <CollectionModal open={showNew} onClose={() => setShowNew(false)} clientId={clientId} invoices={account.invoices.filter(i => i.saldo > 0)} onSaved={onChange} />
    </div>
  );
}

function DocumentosTab({ attachments, clientId, onChange }) {
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('usuario', 'Usuario');
    await api.post(`/clients/${clientId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    onChange();
  }
  return (
    <Card className="p-5">
      <div className="flex justify-between mb-3">
        <div className="text-sm font-semibold text-gray-700">Documentos e imágenes</div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={upload} />
          <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">+ Subir archivo</span>
        </label>
      </div>
      {attachments.length === 0 ? <EmptyState text="Sin archivos." /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {attachments.map(a => (
            <a key={a.id} href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className="border border-gray-100 rounded-md p-3 hover:border-blue-300">
              <div className="text-sm font-medium text-gray-700 truncate">{a.nombre}</div>
              <div className="text-xs text-gray-400">{a.tipo} · {fmtDate(a.fecha)}</div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

function NoteModal({ clientId, onClose, onSaved }) {
  const [texto, setTexto] = useState('');
  async function save(e) { e.preventDefault(); await api.post(`/clients/${clientId}/notes`, { texto, usuario: 'Usuario' }); onSaved(); onClose(); }
  return (
    <Modal open onClose={onClose} title="Agregar nota">
      <form onSubmit={save}>
        <Field label="Nota"><textarea autoFocus required rows={4} className={inputCls} value={texto} onChange={e => setTexto(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></div>
      </form>
    </Modal>
  );
}

function TaskModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({ titulo: '', fecha: new Date().toISOString().slice(0, 10), hora: '', prioridad: 'Media', responsable: '', descripcion: '' });
  async function save(e) { e.preventDefault(); await api.post('/tasks', { ...form, client_id: clientId, usuario: 'Usuario' }); onSaved(); onClose(); }
  return (
    <Modal open onClose={onClose} title="Crear tarea">
      <form onSubmit={save}>
        <Field label="Título *"><input required className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></Field>
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
        <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">Crear tarea</Button></div>
      </form>
    </Modal>
  );
}

const MILESTONE_TYPES = ['Primer contacto', 'Primera reunión', 'Primera cotización', 'Primera venta', 'Venta importante', 'Incorporación de nuevo producto', 'Ensayo realizado', 'Renovación', 'Reclamo', 'Recuperación de cliente', 'Cliente perdido'];

function MilestoneModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({ tipo: MILESTONE_TYPES[0], descripcion: '', fecha: new Date().toISOString().slice(0, 10) });
  async function save(e) { e.preventDefault(); await api.post(`/clients/${clientId}/milestones`, { ...form, usuario: 'Usuario' }); onSaved(); onClose(); }
  return (
    <Modal open onClose={onClose} title="Agregar hito">
      <form onSubmit={save}>
        <Field label="Tipo de hito">
          <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {MILESTONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></Field>
        <Field label="Descripción"><textarea className={inputCls} rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></div>
      </form>
    </Modal>
  );
}

function FileModal({ clientId, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [tipo, setTipo] = useState('Documento');
  async function save(e) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('tipo', tipo);
    fd.append('usuario', 'Usuario');
    await api.post(`/clients/${clientId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    onSaved(); onClose();
  }
  return (
    <Modal open onClose={onClose} title="Subir archivo">
      <form onSubmit={save}>
        <Field label="Archivo"><input type="file" onChange={e => setFile(e.target.files[0])} /></Field>
        <Field label="Tipo"><input className={inputCls} value={tipo} onChange={e => setTipo(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">Subir</Button></div>
      </form>
    </Modal>
  );
}

function MeetingModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({ titulo: 'Reunión comercial', fecha: new Date().toISOString().slice(0, 10), hora: '10:00', tipo: 'Reunion', descripcion: '', prioridad: 'Media', recordatorio: '1 dia antes' });
  async function save(e) { e.preventDefault(); await api.post('/calendar', { ...form, client_id: clientId, usuario: 'Usuario' }); onSaved(); onClose(); }
  return (
    <Modal open onClose={onClose} title="Programar reunión">
      <form onSubmit={save}>
        <Field label="Título"><input className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></Field>
          <Field label="Hora"><input type="time" className={inputCls} value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} /></Field>
        </div>
        <Field label="Recordatorio">
          <select className={inputCls} value={form.recordatorio} onChange={e => setForm(f => ({ ...f, recordatorio: e.target.value }))}>
            {['5 minutos antes', '15 minutos antes', '30 minutos antes', '1 hora antes', '1 dia antes', 'Personalizado'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Descripción"><textarea className={inputCls} rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">Programar</Button></div>
      </form>
    </Modal>
  );
}

function EditClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    razon_social: client.razon_social || '',
    nombre_comercial: client.nombre_comercial || '',
    cuit: client.cuit || '',
    contacto_principal: client.contacto_principal || '',
    cargo: client.cargo || '',
    telefono: client.telefono || '',
    whatsapp: client.whatsapp || '',
    email: client.email || '',
    provincia: client.provincia || '',
    localidad: client.localidad || '',
    direccion: client.direccion || '',
    tipo_cliente: client.tipo_cliente || '',
    segmento: client.segmento || '',
    estado: client.estado || 'Activo',
    potencial_comercial: client.potencial_comercial || 'Medio',
    responsable_comercial: client.responsable_comercial || '',
    ultimo_contacto: client.ultimo_contacto || '',
    proximo_contacto: client.proximo_contacto || '',
    observaciones: client.observaciones || '',
  });
  const [saving, setSaving] = useState(false);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/clients/${client.id}`, {
        ...form,
        ultimo_contacto: form.ultimo_contacto || null,
        proximo_contacto: form.proximo_contacto || null,
        usuario: 'Usuario',
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar cliente" width="max-w-2xl">
      <form onSubmit={save} className="grid grid-cols-2 gap-x-4">
        <Field label="Razón social *"><input required className={inputCls} value={form.razon_social} onChange={set('razon_social')} /></Field>
        <Field label="Nombre comercial"><input className={inputCls} value={form.nombre_comercial} onChange={set('nombre_comercial')} /></Field>
        <Field label="CUIT"><input className={inputCls} value={form.cuit} onChange={set('cuit')} /></Field>
        <Field label="Contacto principal"><input className={inputCls} value={form.contacto_principal} onChange={set('contacto_principal')} /></Field>
        <Field label="Cargo"><input className={inputCls} value={form.cargo} onChange={set('cargo')} /></Field>
        <Field label="Teléfono"><input className={inputCls} value={form.telefono} onChange={set('telefono')} /></Field>
        <Field label="WhatsApp"><input className={inputCls} value={form.whatsapp} onChange={set('whatsapp')} /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
        <Field label="Provincia"><input className={inputCls} value={form.provincia} onChange={set('provincia')} /></Field>
        <Field label="Localidad"><input className={inputCls} value={form.localidad} onChange={set('localidad')} /></Field>
        <Field label="Dirección"><input className={inputCls} value={form.direccion} onChange={set('direccion')} /></Field>
        <Field label="Tipo de cliente"><input className={inputCls} value={form.tipo_cliente} onChange={set('tipo_cliente')} /></Field>
        <Field label="Segmento"><input className={inputCls} value={form.segmento} onChange={set('segmento')} /></Field>
        <Field label="Potencial comercial">
          <select className={inputCls} value={form.potencial_comercial} onChange={set('potencial_comercial')}>
            {POTENCIALES_CLIENTE.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select className={inputCls} value={form.estado} onChange={set('estado')}>
            {ESTADOS_CLIENTE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Responsable comercial"><input className={inputCls} value={form.responsable_comercial} onChange={set('responsable_comercial')} /></Field>
        <Field label="Último contacto"><input type="date" className={inputCls} value={form.ultimo_contacto || ''} onChange={set('ultimo_contacto')} /></Field>
        <Field label="Próximo contacto"><input type="date" className={inputCls} value={form.proximo_contacto || ''} onChange={set('proximo_contacto')} /></Field>
        <div className="col-span-2">
          <Field label="Observaciones"><textarea className={inputCls} rows={3} value={form.observaciones} onChange={set('observaciones')} /></Field>
        </div>
        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const MEDIOS_PAGO = ['Transferencia bancaria', 'Cheque', 'Efectivo', 'E-cheq', 'Tarjeta', 'Otro'];

function CollectionModal({ open, onClose, clientId, invoices, onSaved }) {
  const [form, setForm] = useState({ invoice_id: '', importe: '', medio_pago: 'Transferencia bancaria', comprobante: '', fecha: new Date().toISOString().slice(0, 10), responsable: '', observaciones: '' });
  useEffect(() => {
    if (open && invoices?.length && !form.invoice_id) {
      const first = invoices[0];
      setForm(f => ({ ...f, invoice_id: first.id, importe: first.saldo, factura: first.numero }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  async function save(e) {
    e.preventDefault();
    const inv = invoices.find(i => String(i.id) === String(form.invoice_id));
    await api.post('/collections', { ...form, client_id: clientId, factura: inv?.numero, moneda: inv?.moneda || 'USD' });
    onSaved(); onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Registrar cobranza">
      <form onSubmit={save}>
        <Field label="Factura">
          <select className={inputCls} value={form.invoice_id} onChange={e => {
            const inv = invoices.find(i => String(i.id) === e.target.value);
            setForm(f => ({ ...f, invoice_id: e.target.value, importe: inv?.saldo || f.importe }));
          }}>
            <option value="">Sin factura asociada</option>
            {invoices.map(i => <option key={i.id} value={i.id}>{i.numero} — saldo {i.saldo}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe"><input type="number" step="0.01" required className={inputCls} value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} /></Field>
          <Field label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></Field>
        </div>
        <Field label="Medio de pago">
          <select className={inputCls} value={form.medio_pago} onChange={e => setForm(f => ({ ...f, medio_pago: e.target.value }))}>
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Comprobante"><input className={inputCls} value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))} /></Field>
        <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 mt-3"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">Registrar</Button></div>
      </form>
    </Modal>
  );
}
