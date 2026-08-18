import { useState } from 'react';
import api from '../api/client.js';
import { Card, Button, inputCls } from '../components/UI.jsx';
import { UploadCloud, Download } from 'lucide-react';

const MODES = [
  { value: 'importNew', label: 'Importar nuevos (no tocar existentes)' },
  { value: 'updateExisting', label: 'Actualizar existentes' },
  { value: 'ignoreDuplicates', label: 'Ignorar duplicados' },
];

export default function ImportExcel() {
  const [step, setStep] = useState(1);
  const [fileInfo, setFileInfo] = useState(null);
  const [mapping, setMapping] = useState({});
  const [mode, setMode] = useState('importNew');
  const [dedupeField, setDedupeField] = useState('cuit');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/import/clients/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setFileInfo(data);
    setMapping(data.mapping);
    setStep(2);
    setLoading(false);
  }

  async function confirmImport() {
    setLoading(true);
    const { data } = await api.post('/import/clients/confirm', { uploadId: fileInfo.uploadId, mapping, mode, dedupeField });
    setResult(data);
    setStep(3);
    setLoading(false);
  }

  function reset() { setStep(1); setFileInfo(null); setMapping({}); setResult(null); }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Importar clientes desde Excel</h1>
        <p className="text-sm text-gray-500">Subí un archivo .xlsx, .xls o .csv para cargar clientes de forma masiva. Nunca se elimina información existente automáticamente.</p>
      </div>

      <div className="flex gap-2 text-xs">
        {['1. Subir archivo', '2. Mapear columnas', '3. Resultado'].map((s, i) => (
          <div key={s} className={`px-3 py-1.5 rounded-full ${step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{s}</div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-8 text-center">
          <UploadCloud size={36} className="mx-auto text-gray-300 mb-3" />
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
            <span className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Seleccionar archivo</span>
          </label>
          <p className="text-xs text-gray-400 mt-3">{loading ? 'Procesando...' : 'Formatos soportados: .xlsx, .xls, .csv'}</p>
        </Card>
      )}

      {step === 2 && fileInfo && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-2">Archivo: <span className="font-medium">{fileInfo.filename}</span> · {fileInfo.total} registros detectados</div>
            <div className="text-xs font-medium text-gray-500 mb-2">Mapeo de columnas — Excel → Campo CRM</div>
            <div className="grid md:grid-cols-2 gap-2">
              {fileInfo.headers.map(h => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-1/2 truncate" title={h}>{h}</span>
                  <select className={inputCls} value={mapping[h] || ''} onChange={e => setMapping(m => ({ ...m, [h]: e.target.value || null }))}>
                    <option value="">— No importar —</option>
                    {fileInfo.fields.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 overflow-x-auto">
            <div className="text-xs font-medium text-gray-500 mb-2">Vista previa (primeras {fileInfo.preview.length} filas)</div>
            <table className="text-xs w-full">
              <thead><tr>{fileInfo.headers.map(h => <th key={h} className="text-left px-2 py-1 bg-gray-50">{h}</th>)}</tr></thead>
              <tbody>
                {fileInfo.preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-50">{fileInfo.headers.map(h => <td key={h} className="px-2 py-1 text-gray-600">{String(row[h] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">¿Qué hacer con duplicados?</div>
                {MODES.map(m => (
                  <label key={m.value} className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <input type="radio" name="mode" checked={mode === m.value} onChange={() => setMode(m.value)} /> {m.label}
                  </label>
                ))}
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Identificar duplicados por</div>
                <select className={inputCls} value={dedupeField} onChange={e => setDedupeField(e.target.value)}>
                  <option value="cuit">CUIT</option>
                  <option value="email">Email</option>
                  <option value="razon_social">Razón Social</option>
                </select>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={reset}>Cancelar</Button>
            <Button onClick={confirmImport}>{loading ? 'Importando...' : 'Confirmar importación'}</Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <Card className="p-6 space-y-3">
          <div className="text-lg font-semibold text-gray-800">Importación completada</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <Stat label="Total filas" value={result.total} />
            <Stat label="Nuevos" value={result.imported} color="#0ca30c" />
            <Stat label="Actualizados" value={result.updated} color="#2a78d6" />
            <Stat label="Duplicados" value={result.duplicates} color="#eda100" />
            <Stat label="Errores" value={result.errores} color="#d03b3b" />
          </div>
          {result.errorReportId && (
            <Button variant="secondary" onClick={() => window.open(`/api/import/errors/${result.errorReportId}`, '_blank')}>
              <Download size={14} className="inline mr-1" /> Descargar reporte de errores
            </Button>
          )}
          <div className="pt-2"><Button onClick={reset}>Importar otro archivo</Button></div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="text-2xl font-bold" style={{ color: color || '#0b0b0b' }}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
