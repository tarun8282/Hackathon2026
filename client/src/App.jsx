import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Pages
import Auth from './pages/Auth';
import CitizenDashboard from './pages/CitizenDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for session
    const checkSession = () => {
      const savedUser = localStorage.getItem('user_session');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={!user ? <Auth /> : (user.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/citizen" replace />)}
        />

        {/* Protected Routes */}
        <Route
          path="/citizen"
          element={user ? <CitizenDashboard /> : <Navigate to="/auth" replace />}
        />

        <Route
          path="/admin"
          element={user && user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/citizen" replace />}
        />

        {/* Home redirect */}
        <Route
          path="/"
          element={<Navigate to={user ? (user.role === 'admin' ? "/admin" : "/citizen") : "/auth"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
