import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

function isoToDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function displayToIso(display) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Descarta fechas imposibles (ej. 31/02) construyendo la fecha y comprobando
  // que no se haya "corrido" a otro día/mes — new Date(2026, 1, 31) da 3/3, no
  // vuelve a tirar error, así que hay que revisarlo a mano.
  const test = new Date(y, mo - 1, d);
  if (test.getFullYear() !== y || test.getMonth() !== mo - 1 || test.getDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Reemplazo de <input type="date"> que siempre muestra y acepta dd/mm/aaaa,
// sin importar el idioma/región configurados en el navegador. El
// <input type="date"> nativo guarda el valor siempre en "aaaa-mm-dd" por
// dentro, pero el formato que le MUESTRA al usuario para escribir/leer lo
// decide el navegador según su locale — en uno configurado en inglés (u otro
// país) eso se veía como "mm/dd/aaaa" aunque el resto de la app ya esté en
// dd/mm/aaaa (formato de fecha unificado el 4/9/2026).
//
// Mismo contrato que un <input type="date"> controlado (value/onChange con un
// string "aaaa-mm-dd", o "" si está vacío), así que es un reemplazo directo.
// El ícono de calendario abre el selector nativo del navegador para elegir
// con el mouse (o el picker propio del sistema en celular); el texto que se
// ve siempre es dd/mm/aaaa, se pueda o no abrir ese selector nativo.
export default function DateInput({ value, onChange, className = '', required, disabled, placeholder, id }) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const nativeRef = useRef(null);

  // Si el valor cambia desde afuera (ej. se resetea el formulario, o se elige
  // desde el calendario nativo) se refleja en el texto mostrado.
  useEffect(() => { setText(isoToDisplay(value)); }, [value]);

  function handleTextChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    if (out.length === 10) {
      const iso = displayToIso(out);
      if (iso) onChange(iso);
    } else if (out === '') {
      onChange('');
    }
  }

  function openPicker() {
    if (disabled) return;
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* algunos navegadores lo bloquean (ej. sin gesto del usuario) — sigue al fallback */ }
    }
    el.focus();
    el.click();
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder || 'dd/mm/aaaa'}
        className={`${className} pr-8`}
        value={text}
        onChange={handleTextChange}
        required={required}
        disabled={disabled}
        maxLength={10}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        title="Elegir fecha"
      >
        <Calendar size={14} />
      </button>
      {/* Input nativo, invisible: sólo sirve para abrir el selector del
          navegador desde el ícono. Su valor se mantiene igual al de arriba, y
          su onChange es la única otra forma de actualizar el campo (al elegir
          una fecha con el mouse en ese selector). */}
      <input
        ref={nativeRef}
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}
