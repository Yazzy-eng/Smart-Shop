import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />

            <Route
              path="/customers"
              element={<ProtectedRoute roles={['admin', 'manager']}><Customers /></ProtectedRoute>}
            />
            <Route
              path="/inventory"
              element={<ProtectedRoute roles={['admin', 'manager']}><Inventory /></ProtectedRoute>}
            />
            <Route
              path="/reports"
              element={<ProtectedRoute roles={['admin', 'manager']}><Reports /></ProtectedRoute>}
            />
            <Route
              path="/admin/users"
              element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>}
            />
            <Route
              path="/admin/settings"
              element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>}
            />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
