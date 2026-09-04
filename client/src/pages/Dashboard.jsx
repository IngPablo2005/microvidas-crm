import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { KpiCard, Card, Badge, fmtUSD, fmtDateTime, Loading, Button, Field, inputCls } from '../components/UI.jsx';
import ClientPicker from '../components/ClientPicker.jsx';
import { CATEGORICAL, STATUS } from '../colors.js';
import {
  DollarSign, TrendingUp, FileText, Target, CheckSquare, AlertTriangle, Users, Wallet, Clock, Phone, MapPin, FlaskConical
} from 'lucide-react';

const STAGE_LABELS = {
  Prospecto: 'Prospecto', Contactado: 'Contactado', Reunion: 'Reunión', Cotizacion: 'Cotización',
  Negociacion: 'Negociación', Ganada: 'Ganada', Perdida: 'Perdida',
};
const STAGE_ORDER = ['Prospecto', 'Contactado', 'Reunion', 'Cotizacion', 'Negociacion', 'Ganada', 'Perdida'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [tasksToday, setTasksToday] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [d, a, t] = await Promise.all([
      api.get('/dashboard'),
      api.get('/dashboard/alerts'),
      api.get('/tasks', { params: { fecha: new Date().toISOString().slice(0, 10) } }),
    ]);
    setData(d.data);
    setAlerts(a.data);
    setTasksToday(t.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function completeTask(id) {
    await api.patch(`/tasks/${id}/complete`);
    load();
  }

  if (loading || !data) return <Loading />;

  const pipelineByStage = Object.fromEntries((data.pipeline || []).map(p => [p.etapa, p]));
  const maxPipelineValor = Math.max(1, ...STAGE_ORDER.map(s => pipelineByStage[s]?.valor || 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Dashboard comercial</h1>
        <p className="text-sm text-gray-500">Qué tengo que hacer hoy, qué vendí, qué oportunidades tengo abiertas.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ventas hoy" value={fmtUSD(data.ventas.hoy)} sub={`${data.ventas.ops_hoy} operaciones · ${data.ventas.clientes_hoy} clientes`} icon={DollarSign} onClick={() => navigate('/ventas')} />
        <KpiCard label="Ventas semana" value={fmtUSD(data.ventas.semana)} icon={TrendingUp} onClick={() => navigate('/ventas')} />
        <KpiCard label="Ventas mes" value={fmtUSD(data.ventas.mes)} sub={`Objetivo ${fmtUSD(data.ventas.objetivo_mensual)} · ${data.ventas.cumplimiento_pct}% cumplido`} accent={data.ventas.cumplimiento_pct >= 100 ? STATUS.good : undefined} icon={TrendingUp} onClick={() => navigate('/ventas')} />
        <KpiCard label="Ventas año" value={fmtUSD(data.ventas.anio)} icon={TrendingUp} onClick={() => navigate('/ventas')} />

        <KpiCard label="Cotizaciones abiertas" value={data.cotizaciones.abiertas} sub={`${fmtUSD(data.cotizaciones.valor_abiertas)} en oportunidades`} icon={FileText} onClick={() => navigate('/cotizaciones')} />
        <KpiCard label="Pipeline (valor)" value={fmtUSD(STAGE_ORDER.filter(s => !['Ganada', 'Perdida'].includes(s)).reduce((s, st) => s + (pipelineByStage[st]?.valor || 0), 0))} icon={Target} onClick={() => navigate('/pipeline')} />
        <KpiCard label="Prospectos activos" value={data.prospectos.total} sub={`${data.prospectos.nuevos} nuevos · ${data.prospectos.alta_probabilidad} alta prob.`} icon={Target} onClick={() => navigate('/prospectos')} />
        <KpiCard label="Tasa de conversión" value={`${data.conversion.cotizaciones_pct}%`} sub={`Cotizaciones → ventas · Prospectos → clientes ${data.conversion.prospectos_pct}%`} icon={TrendingUp} onClick={() => navigate('/reportes')} />

        <KpiCard label="Tareas de hoy" value={data.tareas.hoy} sub={data.tareas.proxima ? `Próxima: ${data.tareas.proxima.hora || ''} ${data.tareas.proxima.titulo}` : 'Sin tareas próximas'} icon={CheckSquare} onClick={() => navigate('/tareas')} />
        <KpiCard label="Tareas vencidas" value={data.tareas.vencidas} accent={data.tareas.vencidas > 0 ? STATUS.critical : undefined} icon={AlertTriangle} onClick={() => navigate('/tareas')} />
        <KpiCard label="Clientes activos" value={data.clientes.activos} sub={`${data.clientes.nuevos} nuevos (30 días)`} icon={Users} onClick={() => navigate('/clientes')} />
        <KpiCard label="Cuentas a cobrar" value={fmtUSD(data.cobranzas.cuentas_a_cobrar)} sub={`${fmtUSD(data.cobranzas.vencido)} vencido`} accent={data.cobranzas.vencido > 0 ? STATUS.critical : undefined} icon={Wallet} onClick={() => navigate('/cobranzas')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Pipeline comercial</h2>
          <div className="space-y-3">
            {STAGE_ORDER.map((stage, i) => {
              const info = pipelineByStage[stage] || { cantidad: 0, valor: 0 };
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium text-gray-700">{STAGE_LABELS[stage]}</span>
                    <span>{info.cantidad} oport. · {fmtUSD(info.valor)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(info.valor / maxPipelineValor) * 100}%`, backgroundColor: CATEGORICAL[i % CATEGORICAL.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/pipeline')}>Ver pipeline completo →</Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Tareas de hoy</h2>
          {tasksToday.length === 0 && <p className="text-sm text-gray-400">No hay tareas para hoy.</p>}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tasksToday.map(t => (
              <div key={t.id} className="flex items-start gap-2 border border-gray-100 rounded-md p-2.5">
                <input type="checkbox" checked={t.estado === 'Completada'} onChange={() => completeTask(t.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${t.estado === 'Completada' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.titulo}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <Clock size={11} /> {t.hora || 'Sin hora'} {t.cliente_nombre ? `· ${t.cliente_nombre}` : ''}
                  </div>
                </div>
                <Badge text={t.prioridad} colorKey={t.prioridad === 'Alta' ? 'Vencida' : t.prioridad === 'Media' ? 'Contactado' : 'Inactivo'} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <VisitasLlamadasCard />

      <Card className="p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Alertas inteligentes</h2>
        {alerts.length === 0 && <p className="text-sm text-gray-400">Sin alertas activas.</p>}
        <div className="grid md:grid-cols-2 gap-2">
          {alerts.slice(0, 12).map((a, i) => (
            <div
              key={i}
              onClick={() => a.client_id && navigate(`/clientes/${a.client_id}`)}
              className={`flex items-start gap-2 p-2.5 rounded-md border text-sm cursor-pointer hover:shadow-sm ${
                a.severidad === 'alta' ? 'border-red-200 bg-red-50' : a.severidad === 'media' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <AlertTriangle size={14} className={a.severidad === 'alta' ? 'text-red-500' : a.severidad === 'media' ? 'text-amber-500' : 'text-blue-500'} />
              <div>
                <div className="font-medium text-gray-700 text-xs">{a.tipo}</div>
                <div className="text-gray-600">{a.mensaje}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const TIPOS_REGISTRABLES = ['Visita', 'Llamada', 'Ensayo'];

function VisitasLlamadasCard() {
  const [clients, setClients] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [form, setForm] = useState({ client_id: '', tipo: 'Visita', fecha: new Date().toISOString().slice(0, 10), descripcion: '' });
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  async function loadRecientes() {
    setLoadingList(true);
    const { data } = await api.get('/activities', { params: { tipo: TIPOS_REGISTRABLES.join(','), limit: 8 } });
    setRecientes(data);
    setLoadingList(false);
  }

  // Se usa tanto al montar como cada vez que se abre el buscador de clientes
  // (ver ClientPicker onOpen más abajo), para que un cliente recién cargado en
  // otra pestaña/pantalla aparezca sin tener que recargar toda la página.
  function refreshClients() {
    return api.get('/clients', { params: { pageSize: 300 } }).then(({ data }) => setClients(data.rows));
  }

  useEffect(() => {
    refreshClients();
    loadRecientes();
  }, []);

  async function registrar(e) {
    e.preventDefault();
    if (!form.client_id) return alert('Seleccioná un cliente');
    setSaving(true);
    try {
      await api.post('/activities', { ...form, usuario: 'Usuario' });
      setForm(f => ({ ...f, client_id: '', descripcion: '' }));
      loadRecientes();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Phone size={16} className="text-blue-500" /> Registrar visita, llamada o ensayo</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={registrar} className="space-y-1">
          <Field label="Cliente *">
            <ClientPicker clients={clients} value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))} onOpen={refreshClients} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_REGISTRABLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </Field>
          </div>
          <Field label="Comentario">
            <textarea rows={2} className={inputCls} placeholder="Ej: se mostró interesado en ampliar el pedido..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </Field>
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>

        <div>
          <div className="text-xs text-gray-400 uppercase font-medium mb-2">Últimas registradas</div>
          {loadingList ? <Loading /> : recientes.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no registraste visitas, llamadas ni ensayos.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recientes.map(r => (
                <div key={r.id} className="flex items-start gap-2 border border-gray-100 rounded-md p-2.5">
                  {r.tipo === 'Visita' ? <MapPin size={14} className="text-emerald-500 mt-0.5" /> : r.tipo === 'Ensayo' ? <FlaskConical size={14} className="text-purple-500 mt-0.5" /> : <Phone size={14} className="text-blue-500 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">{r.cliente_nombre}</div>
                    <div className="text-xs text-gray-400">{r.tipo} · {fmtDateTime(r.fecha)}</div>
                    {r.descripcion && <div className="text-xs text-gray-500 mt-0.5">{r.descripcion}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
