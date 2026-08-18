import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage_getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// En artefactos/prototipos de Claude no se puede usar localStorage; aquí sí corre en Vite dev normal,
// pero mantenemos el estado también en memoria como respaldo.
let memoryToken = null;
export function setToken(token) {
  memoryToken = token;
  try { window.localStorage.setItem('crm_token', token || ''); } catch (e) { /* noop */ }
}
export function getToken() {
  if (memoryToken) return memoryToken;
  try { return window.localStorage.getItem('crm_token'); } catch (e) { return null; }
}
function localStorage_getToken() { return getToken(); }

export function setUser(user) {
  try { window.localStorage.setItem('crm_user', JSON.stringify(user || null)); } catch (e) { /* noop */ }
}
export function getUser() {
  try { return JSON.parse(window.localStorage.getItem('crm_user') || 'null'); } catch (e) { return null; }
}

export default api;
