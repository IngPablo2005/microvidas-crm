import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Users, Target, GitBranch, FileText, ShoppingCart, CheckSquare,
  Calendar, Activity, Award, BarChart3, Upload, Settings, Search, LogOut, Wallet, X, Menu, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/prospectos', label: 'Prospectos', icon: Target },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/cobranzas', label: 'Cobranzas', icon: Wallet },
  { to: '/tareas', label: 'Tareas', icon: CheckSquare },
  { to: '/calendario', label: 'Calendario', icon: Calendar },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/importar', label: 'Importar Excel', icon: Upload },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get('/search', { params: { q: query } });
      setResults(data);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setResults(null); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function goTo(path) { setQuery(''); setResults(null); navigate(path); }

  return (
    <div className="flex h-screen bg-[#f5f6f8] text-[#0b0b0b]">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`w-60 bg-[#0f172a] text-white flex flex-col shrink-0 fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight">Microvidas CRM</div>
            <div className="text-xs text-white/50">Gestión comercial</div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-white/10 text-white font-medium border-r-2 border-blue-400' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
          <div className="font-medium text-white/90">{user?.name}</div>
          <div>{user?.role}</div>
          <button onClick={logout} className="flex items-center gap-1.5 mt-2 text-white/60 hover:text-white">
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-3 md:px-6 gap-2 md:gap-4 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>
          <div className="relative flex-1 max-w-lg" ref={boxRef}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar clientes, cotizaciones, ventas, tareas..."
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
            {results && (
              <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto z-50 text-sm">
                <SearchGroup title="Clientes" items={results.clients} onClick={c => goTo(`/clientes/${c.id}`)} render={c => c.razon_social} />
                <SearchGroup title="Prospectos" items={results.prospects} onClick={() => goTo('/prospectos')} render={p => p.empresa} />
                <SearchGroup title="Contactos" items={results.contacts} onClick={c => goTo(`/clientes/${c.client_id}`)} render={c => `${c.nombre} (${c.razon_social})`} />
                <SearchGroup title="Cotizaciones" items={results.quotes} onClick={() => goTo('/cotizaciones')} render={q => `${q.numero} — ${q.razon_social}`} />
                <SearchGroup title="Ventas" items={results.sales} onClick={() => goTo('/ventas')} render={s => `${s.numero} — ${s.razon_social}`} />
                <SearchGroup title="Tareas" items={results.tasks} onClick={() => goTo('/tareas')} render={t => t.titulo} />
                <SearchGroup title="Productos" items={results.products} onClick={() => goTo('/cotizaciones')} render={p => p.nombre} />
                {Object.values(results).every(arr => !arr.length) && <div className="px-3 py-3 text-gray-400">Sin resultados</div>}
              </div>
            )}
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const REF_ROUTES = {
  tasks: '/tareas',
  calendar_events: '/calendario',
  quotes: '/cotizaciones',
  invoices: '/cobranzas',
  payment_commitments: '/cobranzas',
  clients: '/clientes',
  pipeline: '/pipeline',
};

function timeAgo(iso) {
  const diffMin = Math.round((Date.now() - new Date(iso + 'Z').getTime()) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return `hace ${Math.round(diffH / 24)} d`;
}

function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const seenIds = useRef(new Set());
  const permissionAsked = useRef(false);

  useEffect(() => {
    if (!permissionAsked.current && 'Notification' in window && Notification.permission === 'default') {
      permissionAsked.current = true;
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { data } = await api.get('/notifications/due');
        if (cancelled) return;
        const fresh = data.filter(n => !seenIds.current.has(n.id));
        for (const n of fresh) {
          seenIds.current.add(n.id);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(n.tipo || 'Microvidas CRM', { body: n.mensaje });
          }
        }
        data.forEach(n => seenIds.current.add(n.id));
        setItems(data);
      } catch (e) { /* noop */ }
    }
    poll();
    const interval = setInterval(poll, 45000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markRead(n) {
    await api.patch(`/notifications/${n.id}/read`);
    setItems(prev => prev.filter(i => i.id !== n.id));
    setOpen(false);
    const route = REF_ROUTES[n.ref_table];
    if (n.client_id) navigate(`/clientes/${n.client_id}`);
    else if (route) navigate(route);
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    setItems([]);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setOpen(o => !o)} className="relative p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100">
        <Bell size={19} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500">Notificaciones</span>
            {items.length > 0 && <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Marcar todas leídas</button>}
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">Sin avisos pendientes</div>
          ) : (
            items.map(n => (
              <div key={n.id} onClick={() => markRead(n)} className="px-3 py-2.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer">
                <div className="text-xs font-medium text-gray-700">{n.tipo}</div>
                <div className="text-sm text-gray-600">{n.mensaje}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ title, items, onClick, render }) {
  if (!items || !items.length) return null;
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-50">{title}</div>
      {items.map((it, i) => (
        <div key={i} onClick={() => onClick(it)} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-700">
          {render(it)}
        </div>
      ))}
    </div>
  );
}
