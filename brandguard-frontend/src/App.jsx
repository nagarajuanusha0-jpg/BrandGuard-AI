
import './styles/App.css';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet
} from 'react-router-dom';

import { useEffect, useState } from 'react';

import {
  getToken,
  getCurrentUser,
  saveAuth,
  logoutUser
} from './services/api';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Guidelines from './pages/Guidelines';
import SubmitContent from './pages/SubmitContent';
import MySubmissions from './pages/MySubmissions';
import Findings from './pages/Findings';

import Review from './pages/Review';
import UserManagement from './pages/UserManagement';
import AllSubmissions from './pages/AllSubmissions';

// Protect all application pages
function ProtectedRoute() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const verifyUser = async () => {
      const token = getToken();

      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const data = await getCurrentUser();
        const user = data.user || data;

        saveAuth(token, user);
        setStatus('authenticated');
      } catch {
        logoutUser();
        setStatus('unauthenticated');
      }
    };

    verifyUser();
  }, []);

  if (status === 'checking') {
    return <div>Verifying your login...</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/guidelines" element={<Guidelines />} />
          <Route path="/submit" element={<SubmitContent />} />
          <Route path="/submissions" element={<MySubmissions />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/review" element={<Review />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/all-submissions" element={<AllSubmissions />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
