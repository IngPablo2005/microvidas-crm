import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { inputCls } from '../components/UI.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('psolier@microvidas.com.ar');
  const [password, setPassword] = useState('microvidas2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-xl font-bold text-gray-800">Microvidas CRM</div>
          <div className="text-sm text-gray-400">Gestión de clientes, ventas y actividades</div>
        </div>
        <form onSubmit={onSubmit}>
          <label className="block mb-3">
            <span className="block text-xs font-medium text-gray-600 mb-1">Email</span>
            <input className={inputCls} value={email} onChange={e => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="block mb-4">
            <span className="block text-xs font-medium text-gray-600 mb-1">Contraseña</span>
            <input className={inputCls} value={password} onChange={e => setPassword(e.target.value)} type="password" required />
          </label>
          {error && <div className="text-xs text-red-600 mb-3">{error}</div>}
          <button disabled={loading} className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div className="mt-4 text-xs text-gray-400 text-center">
          Usuario demo: psolier@microvidas.com.ar / microvidas2026
        </div>
      </div>
    </div>
  );
}
