import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Layout from './components/Layout';
import InteractiveReserve from './pages/InteractiveReserve';
import ScheduledTasks from './pages/ScheduledTasks';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="reserve" element={<InteractiveReserve />} />
          <Route path="tasks" element={<ScheduledTasks />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
