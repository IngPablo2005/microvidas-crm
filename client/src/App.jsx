import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClientsList from './pages/clients/ClientsList.jsx';
import ClientDetail from './pages/clients/ClientDetail.jsx';
import Prospects from './pages/Prospects.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Quotes from './pages/Quotes.jsx';
import Sales from './pages/Sales.jsx';
import Tasks from './pages/Tasks.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Collections from './pages/Collections.jsx';
import Reports from './pages/Reports.jsx';
import ImportExcel from './pages/ImportExcel.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<ClientsList />} />
            <Route path="clientes/:id" element={<ClientDetail />} />
            <Route path="prospectos" element={<Prospects />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="cotizaciones" element={<Quotes />} />
            <Route path="ventas" element={<Sales />} />
            <Route path="cobranzas" element={<Collections />} />
            <Route path="tareas" element={<Tasks />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="reportes" element={<Reports />} />
            <Route path="importar" element={<ImportExcel />} />
            <Route path="configuracion" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
