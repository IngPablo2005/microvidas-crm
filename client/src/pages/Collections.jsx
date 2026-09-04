import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { Card, KpiCard, Badge, Button, Modal, Field, inputCls, Loading, EmptyState, fmtUSD, fmtMoneda, fmtDate } from '../components/UI.jsx';
import ClientPicker from '../components/ClientPicker.jsx';
import DateInput from '../components/DateInput.jsx';
import { STATUS } from '../colors.js';
import { Plus, Download, Wallet, Pencil, CheckCircle2 } from 'lucide-react';

const MEDIOS_PAGO = ['Transferencia bancaria', 'Cheque', 'Efectivo', 'E-cheq', 'Tarjeta', 'Otro'];
const MONEDAS = ['USD', 'ARS'];

export default function Collections() {
  const [dash, setDash] = useState(null);
  const [rows, setRows] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [tab, setTab] = useState('cobranzas');

  // Se usa tanto en el load() general como cada vez que se abre el buscador de
  // clientes de los formularios, así un cliente recién cargado en otra pestaña
  // aparece sin recargar toda la página.
  function refreshClients() {
    return api.get('/clients', { params: { pageSize: 200 } }).then(({ data }) => setClients(data.rows));
  }

  async function load() {
    setLoading(true);
    const [d, c, cm, inv] = await Promise.all([
      api.get('/dashboard'),
      api.get('/collections'),
      api.get('/collections/commitments'),
      api.get('/collections/invoices'),
      refreshClients(),
    ]);
    setDash(d.data);
    setRows(c.data);
    setCommitments(cm.data);
    setInvoices(inv.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function markCommitment(id, estado) {
    await api.patch(`/collections/commitments/${id}/estado`, { estado });
    load();
  }

  // "Tildar como cobrada" una factura pendiente: registra una cobranza por el
  // saldo restante (mismo endpoint que usa "Registrar cobranza"), lo que además
  // deja el pago en el historial de Cobranzas y en la cuenta corriente del
  // cliente, en vez de sólo cambiar el estado de la factura sin dejar rastro.
  async function markInvoicePaid(inv) {
    if (!window.confirm(`¿Marcar la factura ${inv.numero} (saldo ${fmtMoneda(inv.saldo, inv.moneda)}) como cobrada?`)) return;
    setMarkingPaid(inv.id);
    try {
      await api.post('/collections', {
        client_id: inv.client_id,
        invoice_id: inv.id,
        factura: inv.numero,
        importe: inv.saldo,
        moneda: inv.moneda || 'USD',
        medio_pago: 'Transferencia bancaria',
        fecha: new Date().toISOString().slice(0, 10),
        observaciones: 'Marcada como cobrada desde Facturas.',
        usuario: 'Usuario',
      });
      load();
    } finally {
      setMarkingPaid(null);
    }
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
                <tr><th className="text-left px-4 py-2.5">Fecha</th><th className="text-left px-4 py-2.5">Cliente</th><th className="text-left px-4 py-2.5">Factura</th><th className="text-left px-4 py-2.5">Medio de pago</th><th className="text-right px-4 py-2.5">Importe</th><th className="px-4 py-2.5"></th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-blue-50">
                    <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.fecha)}</td>
                    <td className="px-4 py-2.5"><Link to={`/clientes/${r.client_id}`} className="font-medium text-gray-800 hover:text-blue-600">{r.cliente_nombre}</Link></td>
                    <td className="px-4 py-2.5 text-gray-600">{r.factura}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.medio_pago}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtMoneda(r.importe, r.moneda)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button title="Editar cobranza" onClick={() => setEditing(r)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50">
                        <Pencil size={14} />
                      </button>
                    </td>
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
              <tr><th className="text-left px-4 py-2.5">Número</th><th className="text-left px-4 py-2.5">Cliente</th><th className="text-left px-4 py-2.5">Vencimiento</th><th className="text-right px-4 py-2.5">Importe</th><th className="text-right px-4 py-2.5">Saldo</th><th className="text-left px-4 py-2.5">Estado</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody>
              {invoices.map(i => (
                <tr key={i.id} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-4 py-2.5">{i.numero}</td>
                  <td className="px-4 py-2.5"><Link to={`/clientes/${i.client_id}`} className="font-medium text-gray-800 hover:text-blue-600">{i.cliente_nombre}</Link></td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(i.fecha_vencimiento)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtMoneda(i.importe, i.moneda)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtMoneda(i.saldo, i.moneda)}</td>
                  <td className="px-4 py-2.5"><Badge text={i.estado} /></td>
                  <td className="px-4 py-2.5">
                    {i.saldo > 0 && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-green-600" title="Marcar como cobrada">
                        <input
                          type="checkbox"
                          disabled={markingPaid === i.id}
                          onChange={() => markInvoicePaid(i)}
                          className="accent-green-600"
                        />
                        <CheckCircle2 size={13} /> Cobrada
                      </label>
                    )}
                  </td>
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

      {showNew && (
        <CollectionFormModal onClose={() => setShowNew(false)} clients={clients} onOpenClientPicker={refreshClients} onSaved={() => { setShowNew(false); load(); }} />
      )}
      {editing && (
        <CollectionFormModal editing={editing} onClose={() => setEditing(null)} clients={clients} onOpenClientPicker={refreshClients} onSaved={() => { setEditing(null); load(); }} />
      )}
      <CommitmentModal open={showCommit} onClose={() => setShowCommit(false)} clients={clients} onOpenClientPicker={refreshClients} onSaved={() => { setShowCommit(false); load(); }} />
    </div>
  );
}

// Mismo formulario para "Registrar cobranza" y "Editar cobranza" — con `editing`
// (la fila de la cobranza ya cargada) arranca precargado y guarda con PUT en
// vez de POST. El cliente no se puede cambiar al editar (la cobranza queda
// atada a la cuenta corriente del cliente con el que se creó).
function CollectionFormModal({ editing, onClose, clients, onOpenClientPicker, onSaved }) {
  const isEditing = !!editing;
  const [form, setForm] = useState({
    client_id: editing?.client_id || '', importe: editing?.importe ?? '', moneda: editing?.moneda || 'USD',
    medio_pago: editing?.medio_pago || 'Transferencia bancaria', comprobante: editing?.comprobante || '', factura: editing?.factura || '',
    fecha: editing?.fecha?.slice(0, 10) || new Date().toISOString().slice(0, 10), responsable: editing?.responsable || '', observaciones: editing?.observaciones || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const clienteActual = clients.find(c => String(c.id) === String(form.client_id));

  async function save(e) {
    e.preventDefault();
    // Antes el <select> nativo con `required` bastaba para exigir un cliente;
    // el buscador de texto no tiene ese mecanismo, así que se valida acá.
    if (!form.client_id) return alert('Seleccioná un cliente');
    setSaving(true);
    setSaveError('');
    try {
      if (isEditing) await api.put(`/collections/${editing.id}`, form);
      else await api.post('/collections', form);
      onSaved();
    } catch (err) {
      setSaveError('No se pudo guardar la cobranza. Probá de nuevo en unos segundos.');
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar cobranza' : 'Registrar cobranza'}>
      <form onSubmit={save}>
        {isEditing ? (
          <Field label="Cliente"><div className="text-sm font-medium text-gray-700 py-1.5">{clienteActual?.razon_social || editing.cliente_nombre}</div></Field>
        ) : (
          <Field label="Cliente *">
            <ClientPicker clients={clients} value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))} onOpen={onOpenClientPicker} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe *"><input type="number" step="0.01" required className={inputCls} value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} /></Field>
          <Field label="Moneda">
            <select className={inputCls} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
              {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Fecha"><DateInput className={inputCls} value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} /></Field>
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
        {saveError && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mt-2">{saveError}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Registrar')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CommitmentModal({ open, onClose, clients, onOpenClientPicker, onSaved }) {
  const [form, setForm] = useState({ client_id: '', importe_comprometido: '', fecha_comprometida: '', responsable: '', observaciones: '' });
  if (!open) return null;
  async function save(e) {
    e.preventDefault();
    // Antes el <select> nativo con `required` bastaba para exigir un cliente;
    // el buscador de texto no tiene ese mecanismo, así que se valida acá.
    if (!form.client_id) return alert('Seleccioná un cliente');
    await api.post('/collections/commitments', form);
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="Nuevo compromiso de pago">
      <form onSubmit={save}>
        <Field label="Cliente *">
          <ClientPicker clients={clients} value={form.client_id} onChange={v => setForm(f => ({ ...f, client_id: v }))} onOpen={onOpenClientPicker} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe comprometido *"><input type="number" step="0.01" required className={inputCls} value={form.importe_comprometido} onChange={e => setForm(f => ({ ...f, importe_comprometido: e.target.value }))} /></Field>
          <Field label="Fecha comprometida"><DateInput className={inputCls} value={form.fecha_comprometida} onChange={v => setForm(f => ({ ...f, fecha_comprometida: v }))} /></Field>
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
