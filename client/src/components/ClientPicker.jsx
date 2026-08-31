import { useEffect, useMemo, useRef, useState } from 'react';
import { inputCls } from './UI.jsx';

// Quita acentos para que buscar "Perez" también encuentre "Pérez", sin importar
// mayúsculas/minúsculas.
function normalize(str) {
  return (str || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Selector de cliente con búsqueda en vivo. Reemplaza al <select> con todos los
// clientes listados (que se vuelve incómodo de usar a medida que crece la
// cartera) por un campo de texto: al escribir, filtra por razón social, nombre
// comercial o CUIT; al enfocarlo sin escribir nada, muestra la lista completa
// (hasta 50) para poder elegir igual que antes.
//
// Mismo contrato que un <select> controlado — value/onChange con el id del
// cliente como string — así que es un reemplazo directo. La validación de
// "campo obligatorio" queda a cargo de quien lo usa (revisando `value` antes de
// guardar), en vez de depender del atributo `required` nativo del <select>
// original, que no tiene equivalente confiable en un campo de texto.
//
// `onOpen` (opcional) se dispara cada vez que el usuario abre el buscador
// (foco): sirve para que la pantalla que lo usa pueda refrescar la lista de
// clientes en ese momento, así un cliente recién cargado en otra pestaña/pantalla
// aparece sin necesidad de recargar toda la página.
export default function ClientPicker({ clients, value, onChange, placeholder = 'Buscar cliente...', onOpen, className = '', disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  // Al elegir una opción, el campo suele mostrar debajo un resumen del cliente
  // (por ej. "Empresa: ..."), lo que corre el layout justo debajo del input.
  // Eso alcanza a hacer que el click del mouse, que empieza sobre la opción,
  // termine resolviéndose sobre el input una vez que el resumen aparece,
  // reabriendo el buscador por accidente. Esta bandera hace que ese
  // reabrir-espurio-inmediatamente-después-de-elegir se ignore una vez.
  const justPickedRef = useRef(false);

  const selected = useMemo(() => clients.find(c => String(c.id) === String(value)), [clients, value]);

  // Mientras el campo está cerrado, muestra el nombre del cliente elegido (si
  // hay uno); al abrirlo se usa lo que se va escribiendo para filtrar.
  const displayValue = open ? query : (selected?.razon_social || '');

  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q) return clients.slice(0, 50);
    return clients
      .filter(c => normalize(c.razon_social).includes(q) || normalize(c.nombre_comercial).includes(q) || normalize(c.cuit).includes(q))
      .slice(0, 50);
  }, [clients, query]);

  useEffect(() => { setHighlight(0); }, [query, open]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function openList() {
    if (disabled) return;
    if (justPickedRef.current) { justPickedRef.current = false; return; }
    setQuery('');
    setOpen(true);
    onOpen?.();
  }

  function pick(c) {
    justPickedRef.current = true;
    onChange(String(c.id));
    setQuery('');
    setOpen(false);
  }

  function clearSelection(e) {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }

  function onKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[highlight]) pick(matches[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        className={`${inputCls} pr-7 ${className}`}
        placeholder={placeholder}
        value={displayValue}
        onFocus={openList}
        onClick={openList}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onKeyDown={onKeyDown}
        disabled={disabled}
        autoComplete="off"
      />
      {selected && !open && !disabled && (
        <button
          type="button"
          onClick={clearSelection}
          title="Quitar cliente"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm leading-none"
        >
          ✕
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg text-sm">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-gray-400">Sin resultados</div>
          ) : matches.map((c, i) => (
            <button
              type="button"
              key={c.id}
              onMouseDown={e => { e.preventDefault(); pick(c); }}
              className={`w-full text-left px-3 py-1.5 ${i === highlight ? 'bg-blue-50' : 'hover:bg-blue-50'} ${String(c.id) === String(value) ? 'font-medium text-blue-700' : 'text-gray-700'}`}
            >
              {c.razon_social}
              {c.nombre_comercial && c.nombre_comercial !== c.razon_social && (
                <span className="text-gray-400"> · {c.nombre_comercial}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
