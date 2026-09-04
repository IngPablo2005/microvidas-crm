import { ESTADO_COLOR } from '../colors.js';

export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

export function KpiCard({ label, value, sub, accent, onClick, icon: Icon }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={16} className="text-gray-400" />}
      </div>
      <div className="text-xl md:text-2xl font-semibold break-words" style={{ color: accent || '#0b0b0b' }}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export function Badge({ text, colorKey }) {
  const color = ESTADO_COLOR[colorKey || text] || '#898781';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {text}
    </span>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };
  return (
    <button className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onMouseDown={onClose}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400";

export function EmptyState({ text }) {
  return <div className="text-center text-sm text-gray-400 py-10">{text}</div>;
}

export function Loading() {
  return <div className="text-center text-sm text-gray-400 py-10">Cargando...</div>;
}

export function fmtUSD(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

// A diferencia de fmtUSD (redondea a entero — pensado para totales grandes),
// este formato conserva hasta 2 decimales sin redondearlos a un número entero.
// Se usa para precios unitarios (ej. el Catálogo), donde un precio como 42.50
// no debe mostrarse como "43".
export function fmtPrecio(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
}

// Formatea un importe según su moneda real (USD o ARS) — se usa en Cobranzas,
// donde una cobranza puede quedar cargada en pesos y no siempre corresponde
// mostrarla con el signo de dólar de fmtUSD.
export function fmtMoneda(n, moneda = 'USD') {
  if (moneda === 'ARS') {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
  }
  return fmtUSD(n);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Formatea una fecha como dd/mm/aaaa (con ceros a la izquierda). Si el valor es
// una fecha "sola" sin hora (ej. "2026-09-04" — así se guardan fecha de
// cotización, venta, tarea, cobranza, etc.), se arma el string directamente en
// vez de pasar por new Date(): convertir "2026-09-04" a un objeto Date lo
// interpreta como medianoche UTC, y en husos horarios negativos como el de
// Argentina (UTC-3) eso mostraba un día antes del real (ej. "3/9/2026" en vez
// de "4/9/2026"). Para valores con hora (timestamps), sigue usando los
// getters locales de Date, sólo que ahora con ceros a la izquierda.
export function fmtDate(d) {
  if (!d) return '—';
  const soloFecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (soloFecha) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// Igual que fmtDate, agregando hora:minuto — para registros que sí guardan
// hora (ej. el timeline de actividades de un cliente).
export function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${fmtDate(d)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
