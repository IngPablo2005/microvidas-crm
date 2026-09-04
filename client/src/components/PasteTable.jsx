// Campo para pegar (Ctrl+V) una tabla copiada de Word o Excel y que quede
// guardada como una tabla real (filas/columnas), no como una imagen. Al pegar:
// 1) si el portapapeles trae HTML con un <table> (lo normal al copiar celdas de
//    Excel o una tabla de Word), se extrae el texto de cada celda;
// 2) si no, se intenta con el texto plano separado por tabs/saltos de línea
//    (lo que Excel también deja en el portapapeles).
// El resultado se guarda como un array de arrays de texto (value/onChange),
// tal cual lo espera el backend en quotes.tabla_pegada.
export default function PasteTable({ value, onChange }) {
  const hasTable = Array.isArray(value) && value.length > 0;

  function handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    let rows = null;

    if (html) {
      try {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const table = parsed.querySelector('table');
        if (table) {
          rows = Array.from(table.rows)
            .map(tr => Array.from(tr.cells).map(td => td.innerText.trim()))
            .filter(r => r.length);
        }
      } catch {
        // si el HTML pegado no se puede parsear, se sigue con el texto plano
      }
    }

    if (!rows || !rows.length) {
      const text = e.clipboardData.getData('text/plain');
      if (text && text.trim()) {
        rows = text.replace(/\r/g, '').split('\n').filter(line => line.length).map(line => line.split('\t'));
      }
    }

    if (rows && rows.length) onChange(rows);
  }

  return (
    <div>
      {!hasTable && (
        <div
          contentEditable
          suppressContentEditableWarning
          onPaste={handlePaste}
          className="border border-dashed border-gray-300 rounded-md px-3 py-4 text-sm text-gray-400 min-h-[60px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          Pegá acá una tabla copiada de Word o Excel (Ctrl+V)
        </div>
      )}
      {hasTable && (
        <div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="text-xs w-full">
              <tbody>
                {value.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 first:border-t-0">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1 border-r border-gray-100 last:border-r-0 align-top whitespace-pre-wrap">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-1.5">
            <button type="button" onClick={() => onChange(null)} className="text-xs text-red-500 hover:underline">Quitar tabla</button>
            <span className="text-xs text-gray-400">Para reemplazarla, quitá esta y pegá una nueva.</span>
          </div>
        </div>
      )}
    </div>
  );
}
