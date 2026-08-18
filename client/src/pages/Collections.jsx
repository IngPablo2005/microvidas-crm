import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { Card, KpiCard, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtUSD, fmtDate } from '../components/UI.jsx';
import { STATUS } from '../colors.js';
import { Plus, Download, Wallet } from 'lucide-react';

const MEDIOS_PAGO = ['Transferencia bancaria', 'Cheque', 'Efectivo', 'E-cheq', 'Tarjeta', 'Otro'];

export default function Collections() {
  const [dash, setDash] = useState(null);
  const [rows, setRows] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [tab, setTab] = useState('cobranzas');

  async function load() {
    setLoading(true);
    const [d, c, cm, inv, cl] = await Promise.all([
      api.get('/dashboard'),
      api.get('/collections'),
      api.get('/collections/commitments'),
      api.get('/collections/invoices'),
      api.get('/clients', { params: { pageSize: 200 } }),
    ]);
    setDash(d.data);
    setRows(c.data);
    setCommitments(cm.data);
    setInvoices(inv.data);
    setClients(cl.data.rows);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function markCommitment(id, estado) {
    await api.patch(`/collections/commitments/${id}/estado`, { estado });
    load();
  }

  if (loading || !dash) return <Loading />;
  const c = dash.cobranzas;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Cobranzas</h1>
          <p className="text-sm text-gray-500">Ventas → Facturación → Cobranzas → Saldo del cliente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.open('/api/export/collections?format=xlsx', '_blank')}><Download size={14} className="inline mr-1" /> Exportar</Button>
          <Button variant="secondary" onClick={() => setShowCommit(true)}>+ Compromiso de pago</Button>
          <Button onClick={() => setShowNew(true)}><Plus size={14} className="inline mr-1" /> Registrar cobranza</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Cobrado hoy" value={fmtUSD(c.hoy)} icon={Wallet} />
        <KpiCard label="Cobrado semana" value={fmtUSD(c.semana)} icon={Wallet} />
        <KpiCard label="Cobrado mes" value={fmtUSD(c.mes)} icon={Wallet} />
        <KpiCard label="Cobrado año" value={fmtUSD(c.anio)} icon={Wallet} />
        <KpiCard label="Cuentas a cobrar" value={fmtUSD(c.cuentas_a_cobrar)} icon={Wallet} />
        <KpiCard label="Vencido" value={fmtUSD(c.vencido)} accent={c.vencido > 0 ? STATUS.critical : undefined} icon={Wallet} />
        <KpiCard label="Próximos vencimientos" value={fmtUSD(c.proximos_vencimientos)} icon={Wallet} />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {['cobranzas', 'facturas', 'compromisos'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'cobranzas' && (
        <Card className="overflow-x-auto">
          {rows.length === 0 ? <EmptyState text="Sin cobranzas registradas." /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="text-left px-4 py-2.5">Fecha</th><th className="text-left px-4 py-2.5">Cliente</th><th className="text-left px-4 py-2.5">Factura</th><th className="text-left px-4 py-2.5">Medio de pago</th><th className="text-right px-4 py-2.5">Importe</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-blue-50">
                    <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.fecha)}</td>
                    <td className="px-4 py-2.5"><Link to={`/clientes/${r.client_id}`} className="font-medium text-gray-800 hover:text-blue-600">{r.cliente_nombre}</Link></td>
                    <td className="px-4 py-2.5 text-gray-600">{r.factura}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.medio_pago}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtUSD(r.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'facturas' && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-2.5">Número</th><th className="text-left px-4 py-2.5">Cliente</th><th className="text-left px-4 py-2.5">Vencimiento</th><th className="text-right px-4 py-2.5">Importe</th><th className="text-right px-4 py-2.5">Saldo</th><th className="text-left px-4 py-2.5">Estado</th></tr>
            </thead>
            <tbody>
              {invoices.map(i => (
                <tr key={i.id} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-4 py-2.5">{i.numero}</td>
                  <td className="px-4 py-2.5"><Link to={`/clientes/${i.client_id}`} className="font-medium text-gray-800 hover:text-blue-600">{i.cliente_nombre}</Link></td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(i.fecha_vencimiento)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtUSD(i.importe)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtUSD(i.saldo)}</td>
                  <td className="px-4 py-2.5"><Badge text={i.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'compromisos' && (
        <Card className="overflow-x-auto">
          {commitments.length === 0 ? <EmptyState text="Sin compromisos de pago." /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="text-left px-4 py-2.5">Cliente</th><th className="text-left px-4 py-2.5">Fecha comprometida</th><th className="text-right px-4 py-2.5">Importe</th><th className="text-left px-4 py-2.5">Estado</th><th className="text-left px-4 py-2.5"></th></tr>
              </thead>
              <tbody>
                {commitments.map(c2 => (
                  <tr key={c2.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5"><Link to={`/clientes/${c2.client_id}`} className="font-medium text-gray-800 hover:text-blue-600">{c2.cliente_nombre}</Link></td>
                    <td className="px-4 py-2.5 text-gray-500">{fmtDate(c2.fecha_comprometida)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtUSD(c2.importe_comprometido)}</td>
                    <td className="px-4 py-2.5"><Badge text={c2.estado} /></td>
                    <td className="px-4 py-2.5">
                      {c2.estado === 'Pendiente' && (
                        <div className="flex gap-2">
                          <button onClick={() => markCommitment(c2.id, 'Cumplido')} className="text-xs text-green-600 hover:underline">Cumplido</button>
                          <button onClick={() => markCommitment(c2.id, 'Incumplido')} className="text-xs text-red-600 hover:underline">Incumplido</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <CollectionCreateModal open={showNew} onClose={() => setShowNew(false)} clients={clients} onSaved={() => { setShowNew(false); load(); }} />
      <CommitmentModal open={showCommit} onClose={() => setShowCommit(false)} clients={clients} onSaved={() => { setShowCommit(false); load(); }} />
    </div>
  );
}

function CollectionCreateModal({ open, onClose, clients, onSaved }) {
  const [form, setForm] = useState({ client_id: '', importe: '', medio_pago: 'Transferencia bancaria', comprobante: '', factura: '', fecha: new Date().toISOString().slice(0, 10), responsable: '', observaciones: '' });
  if (!open) return null;
  async function save(e) {
    e.preventDefault();
    await api.post('/collections', form);
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="Registrar cobranza">
      <form onSubmit={save}>
        <Field label="Cliente *">
          <select required className={inputCls} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
            <option value="">Seleccionar...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe *"><input type="number" step="0.01" required className={inputCls} value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} /></Field>
          <Field label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></Field>
        </div>
        <Field label="Medio de pago">
          <select className={inputCls} value={form.medio_pago} onChange={e => setForm(f => ({ ...f, medio_pago: e.target.value }))}>
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Comprobante"><input className={inputCls} value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))} /></Field>
          <Field label="Factura"><input className={inputCls} value={form.factura} onChange={e => setForm(f => ({ ...f, factura: e.target.value }))} /></Field>
        </div>
        <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></Field>
        <Field label="Observaciones"><textarea className={inputCls} rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Registrar</Button>
        </div>
      </form>
    </Modal>
  );
}

function CommitmentModal({ open, onClose, clients, onSaved }) {
  const [form, setForm] = useState({ client_id: '', importe_comprometido: '', fecha_comprometida: '', responsable: '', observaciones: '' });
  if (!open) return null;
  async function save(e) { e.preventDefault(); await api.post('/collections/commitments', form); onSaved(); }
  return (
    <Modal open={open} onClose={onClose} title="Nuevo compromiso de pago">
      <form onSubmit={save}>
        <Field label="Cliente *">
          <select required className={inputCls} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
            <option value="">Seleccionar...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe comprometido *"><input type="number" step="0.01" required className={inputCls} value={form.importe_comprometido} onChange={e => setForm(f => ({ ...f, importe_comprometido: e.target.value }))} /></Field>
          <Field label="Fecha comprometida"><input type="date" className={inputCls} value={form.fecha_comprometida} onChange={e => setForm(f => ({ ...f, fecha_comprometida: e.target.value }))} /></Field>
        </div>
        <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></Field>
        <Field label="Observaciones"><textarea className={inputCls} rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}
