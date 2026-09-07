// Campo para pegar (Ctrl+V) contenido en la sección "Información adicional" del
// cotizador. Acepta dos cosas distintas en el mismo cuadro:
// 1) una tabla copiada de Word o Excel, que queda guardada como una tabla real
//    (filas/columnas de texto), no como imagen — comportamiento original:
//    - si el portapapeles trae HTML con un <table> (lo normal al copiar celdas
//      de Excel o una tabla de Word), se extrae el texto de cada celda;
//    - si no, se intenta con el texto plano separado por tabs/saltos de línea.
// 2) una imagen (ej. una captura de pantalla, o una foto copiada), que se
//    guarda como una lista de imágenes (hasta MAX_IMAGENES), convertida
//    siempre a JPEG y redimensionada en el navegador antes de guardarla, para
//    no mandar capturas gigantes a la base de datos.
// La tabla se guarda con value/onChange (tal cual espera el backend en
// quotes.tabla_pegada); las imágenes con imagenes/onImagenesChange (JSON de
// data URLs en quotes.imagenes_pegadas).
const MAX_IMAGENES = 4;
const MAX_ANCHO = 1000; // px — alcanza de sobra para verse bien en pantalla y en el PDF
const CALIDAD_JPEG = 0.75;

// Redimensiona y convierte a JPEG una imagen pegada (que puede venir en
// cualquier formato, incluido PNG con transparencia) usando un canvas oculto.
// Devuelve null si la imagen no se pudo decodificar, para no romper el pegado.
function comprimirImagen(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_ANCHO / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // Fondo blanco: al pasar a JPEG (sin canal alfa) una imagen con
      // transparencia se vería con fondo negro si no se rellena antes.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', CALIDAD_JPEG));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export default function PasteTable({ value, onChange, imagenes, onImagenesChange }) {
  const hasTable = Array.isArray(value) && value.length > 0;
  const imagenesArr = Array.isArray(imagenes) ? imagenes : [];

  async function handlePaste(e) {
    // ¿Se pegó una imagen (captura de pantalla, foto, etc.)? Se revisa primero
    // porque un Ctrl+V de imagen no trae ningún <table> ni texto útil.
    const imageItem = onImagenesChange
      ? Array.from(e.clipboardData.items || []).find(it => it.type && it.type.startsWith('image/'))
      : null;
    if (imageItem) {
      e.preventDefault();
      if (imagenesArr.length >= MAX_IMAGENES) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const jpeg = await comprimirImagen(reader.result);
        if (jpeg) onImagenesChange([...imagenesArr, jpeg]);
      };
      reader.readAsDataURL(file);
      return;
    }

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

  function removeImagen(i) {
    onImagenesChange(imagenesArr.filter((_, idx) => idx !== i));
  }

  // El cuadro de pegado se muestra mientras no haya tabla (igual que antes) —
  // así se pueden seguir agregando imágenes de a una sin perder la posibilidad
  // de pegar la tabla más adelante. Si ya hay una tabla pegada, hay que
  // quitarla primero (con "Quitar tabla") para volver a pegar algo en el cuadro.
  const mostrarCuadro = !hasTable;

  return (
    <div>
      {mostrarCuadro && (
        <div
          contentEditable
          suppressContentEditableWarning
          onPaste={handlePaste}
          className="border border-dashed border-gray-300 rounded-md px-3 py-4 text-sm text-gray-400 min-h-[60px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          {onImagenesChange
            ? 'Pegá acá una tabla copiada de Word o Excel, o una imagen (captura de pantalla, foto, etc.) — Ctrl+V'
            : 'Pegá acá una tabla copiada de Word o Excel (Ctrl+V)'}
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
      {onImagenesChange && imagenesArr.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {imagenesArr.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt={`Imagen pegada ${i + 1}`} className="h-20 w-20 object-cover rounded-md border border-gray-200" />
              <button
                type="button"
                onClick={() => removeImagen(i)}
                title="Quitar imagen"
                className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </div>
          ))}
          {imagenesArr.length >= MAX_IMAGENES && (
            <div className="text-xs text-gray-400 self-center">Máximo {MAX_IMAGENES} imágenes.</div>
          )}
        </div>
      )}
    </div>
  );
}
