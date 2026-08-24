import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Badge, Button, Modal, Field, inputCls, Loading, EmptyState } from '../components/UI.jsx';
import { Download, Plus } from 'lucide-react';

const ROLES = ['Administrador', 'Gerente', 'Vendedor', 'Consulta'];
const EXPORT_ENTITIES = [
  { key: 'clients', label: 'Clientes' }, { key: 'prospects', label: 'Prospectos' }, { key: 'sales', label: 'Ventas' },
  { key: 'quotes', label: 'Cotizaciones' }, { key: 'tasks', label: 'Tareas' }, { key: 'activities', label: 'Actividades' },
  { key: 'pipeline', label: 'Pipeline' }, { key: 'milestones', label: 'Hitos' }, { key: 'collections', label: 'Cobranzas' },
  { key: 'invoices', label: 'Facturas' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ objetivo_mensual_usd: '', dias_sin_contacto_alerta: '' });
  const [loading, setLoading] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const canManageUsers = user?.role === 'Administrador' || user?.role === 'Gerente';

  async function load() {
    setLoading(true);
    const [s] = await Promise.all([api.get('/dashboard/settings')]);
    setSettings({ objetivo_mensual_usd: s.data.objetivo_mensual_usd || '', dias_sin_contacto_alerta: s.data.dias_sin_contacto_alerta || '' });
    if (canManageUsers) {
      const u = await api.get('/auth/users');
      setUsers(u.data);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function saveSettings(e) {
    e.preventDefault();
    await api.put('/dashboard/settings', settings);
    alert('Configuración guardada');
  }

  async function toggleActive(u) {
    await api.put(`/auth/users/${u.id}`, { active: !u.active });
    load();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-500">Usuarios, roles, objetivos comerciales y exportación de datos.</p>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold text-gray-700 mb-3">Parámetros comerciales</div>
        <form onSubmit={saveSettings} className="grid md:grid-cols-2 gap-4">
          <Field label="Objetivo mensual de ventas (USD)">
            <input type="number" className={inputCls} value={settings.objetivo_mensual_usd} onChange={e => setSettings(s => ({ ...s, objetivo_mensual_usd: e.target.value }))} />
          </Field>
          <Field label="Días sin llamadas o visitas para alertar">
            <input type="number" className={inputCls} value={settings.dias_sin_contacto_alerta} onChange={e => setSettings(s => ({ ...s, dias_sin_contacto_alerta: e.target.value }))} />
          </Field>
          <div className="md:col-span-2"><Button type="submit">Guardar configuración</Button></div>
        </form>
      </Card>

      {canManageUsers && (
        <Card className="p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-semibold text-gray-700">Usuarios y roles</div>
            {user?.role === 'Administrador' && <Button onClick={() => setShowNewUser(true)}><Plus size={14} className="inline mr-1" /> Nuevo usuario</Button>}
          </div>
          {users.length === 0 ? <EmptyState text="Sin usuarios." /> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 uppercase"><tr><th className="text-left py-1.5">Nombre</th><th className="text-left py-1.5">Email</th><th className="text-left py-1.5">Rol</th><th className="text-left py-1.5">Estado</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="py-2">{u.name}</td>
                    <td className="py-2 text-gray-500">{u.email}</td>
                    <td className="py-2">{u.role}</td>
                    <td className="py-2"><Badge text={u.active ? 'Activo' : 'Inactivo'} /></td>
                    <td className="py-2">
                      {user?.role === 'Administrador' && (
                        <button onClick={() => toggleActive(u)} className="text-xs text-blue-600 hover:underline">{u.active ? 'Desactivar' : 'Activar'}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="text-sm font-semibold text-gray-700 mb-3">Exportar información</div>
        <div className="flex flex-wrap gap-2">
          {EXPORT_ENTITIES.map(e => (
            <Button key={e.key} variant="secondary" onClick={() => window.open(`/api/export/${e.key}?format=xlsx`, '_blank')}>
              <Download size={13} className="inline mr-1" /> {e.label}
            </Button>
          ))}
          <Button onClick={() => window.open('/api/export/all', '_blank')}>
            <Download size={13} className="inline mr-1" /> Exportar todo (Excel con hojas)
          </Button>
        </div>
      </Card>

      {showNewUser && <NewUserModal onClose={() => setShowNewUser(false)} onSaved={() => { setShowNewUser(false); load(); }} />}
    </div>
  );
}

function NewUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: 'microvidas2026', role: 'Vendedor' });
  async function save(e) { e.preventDefault(); await api.post('/auth/users', form); onSaved(); }
  return (
    <Modal open onClose={onClose} title="Nuevo usuario">
      <form onSubmit={save}>
        <Field label="Nombre *"><input required className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Email *"><input required type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
        <Field label="Contraseña"><input className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></Field>
        <Field label="Rol">
          <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Crear usuario</Button>
        </div>
      </form>
    </Modal>
  );
}
